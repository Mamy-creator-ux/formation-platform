import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { totp } from 'otplib'

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

// JWT secret
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-super-secret-key-change-in-production')

// OTP secret for admin (base32 encoded)
const OTP_SECRET = process.env.OTP_SECRET || 'JBSWY3DPEHPK3PXP'

// Helper: Verify JWT token
async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch {
    return null
  }
}

// Helper: Check if user is admin
async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', userId)
    .single()
  return !error && data
}

// ==================== PUBLIC ROUTES ====================

// Get all active videos
app.get('/api/videos', async (c) => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ videos: data })
})

// Get single video
app.get('/api/videos/:id', async (c) => {
  const id = c.req.param('id')
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()
  
  if (error || !data) return c.json({ error: 'Video not found' }, 404)
  return c.json({ video: data })
})

// Get contact information
app.get('/api/contacts', async (c) => {
  const { data, error } = await supabase
    .from('contact_info')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ contacts: data })
})

// Request OTP code for phone verification
app.post('/api/auth/request-otp', async (c) => {
  const { phone_number } = await c.req.json()
  
  if (!phone_number) {
    return c.json({ error: 'Phone number is required' }, 400)
  }
  
  // Generate 6-digit OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  
  // Store OTP in database
  const { error } = await supabase
    .from('otp_codes')
    .insert({
      phone_number,
      code,
      expires_at: expiresAt.toISOString()
    })
  
  if (error) return c.json({ error: error.message }, 500)
  
  // In production, send SMS here (Twilio, etc.)
  // For now, return code in response (remove in production!)
  return c.json({ 
    success: true, 
    message: 'OTP sent',
    // Remove this in production!
    dev_code: code 
  })
})

// Verify OTP code
app.post('/api/auth/verify-otp', async (c) => {
  const { phone_number, code } = await c.req.json()
  
  if (!phone_number || !code) {
    return c.json({ error: 'Phone number and code are required' }, 400)
  }
  
  // Find valid OTP
  const { data: otp, error } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone_number', phone_number)
    .eq('code', code)
    .eq('is_used', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (error || !otp) {
    return c.json({ error: 'Invalid or expired code' }, 401)
  }
  
  // Mark OTP as used
  await supabase
    .from('otp_codes')
    .update({ is_used: true })
    .eq('id', otp.id)
  
  // Generate JWT token
  const token = await new SignJWT({ phone_number, type: 'user' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
  
  return c.json({ success: true, token, message: 'Access granted' })
})

// ==================== ADMIN ROUTES ====================

// Admin login
app.post('/api/admin/login', async (c) => {
  const { email, password } = await c.req.json()
  
  const { data: admin, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .single()
  
  if (error || !admin) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  
  const valid = await bcrypt.compare(password, admin.password_hash)
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  
  const token = await new SignJWT({ id: admin.id, email: admin.email, name: admin.name, type: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(JWT_SECRET)
  
  return c.json({ success: true, token, admin: { id: admin.id, email: admin.email, name: admin.name } })
})

// Admin middleware
const adminAuth = async (c, next) => {
  const auth = c.req.header('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const token = auth.slice(7)
  const payload = await verifyToken(token)
  
  if (!payload || payload.type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403)
  }
  
  const adminCheck = await isAdmin(payload.id)
  if (!adminCheck) {
    return c.json({ error: 'Admin not found' }, 403)
  }
  
  c.set('admin', payload)
  await next()
}

// Get all videos (admin)
app.get('/api/admin/videos', adminAuth, async (c) => {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ videos: data })
})

// Create video (admin)
app.post('/api/admin/videos', adminAuth, async (c) => {
  const { title, description, video_url, thumbnail_url, duration_seconds, category } = await c.req.json()
  
  if (!title || !video_url) {
    return c.json({ error: 'Title and video URL are required' }, 400)
  }
  
  const admin = c.get('admin')
  const { data, error } = await supabase
    .from('videos')
    .insert({
      title,
      description,
      video_url,
      thumbnail_url,
      duration_seconds,
      category,
      created_by: admin.id
    })
    .select()
    .single()
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true, video: data })
})

// Update video (admin)
app.put('/api/admin/videos/:id', adminAuth, async (c) => {
  const id = c.req.param('id')
  const { title, description, video_url, thumbnail_url, duration_seconds, category, is_active } = await c.req.json()
  
  const { data, error } = await supabase
    .from('videos')
    .update({
      title,
      description,
      video_url,
      thumbnail_url,
      duration_seconds,
      category,
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Video not found' }, 404)
  
  return c.json({ success: true, video: data })
})

// Delete video (admin)
app.delete('/api/admin/videos/:id', adminAuth, async (c) => {
  const id = c.req.param('id')
  
  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', id)
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true, message: 'Video deleted' })
})

// Get all contacts (admin)
app.get('/api/admin/contacts', adminAuth, async (c) => {
  const { data, error } = await supabase
    .from('contact_info')
    .select('*')
    .order('display_order', { ascending: true })
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ contacts: data })
})

// Create contact (admin)
app.post('/api/admin/contacts', adminAuth, async (c) => {
  const { type, value, label, display_order } = await c.req.json()
  
  if (!type || !value) {
    return c.json({ error: 'Type and value are required' }, 400)
  }
  
  const { data, error } = await supabase
    .from('contact_info')
    .insert({ type, value, label, display_order: display_order || 0 })
    .select()
    .single()
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true, contact: data })
})

// Update contact (admin)
app.put('/api/admin/contacts/:id', adminAuth, async (c) => {
  const id = c.req.param('id')
  const { type, value, label, display_order, is_active } = await c.req.json()
  
  const { data, error } = await supabase
    .from('contact_info')
    .update({ type, value, label, display_order, is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Contact not found' }, 404)
  
  return c.json({ success: true, contact: data })
})

// Delete contact (admin)
app.delete('/api/admin/contacts/:id', adminAuth, async (c) => {
  const id = c.req.param('id')
  
  const { error } = await supabase
    .from('contact_info')
    .delete()
    .eq('id', id)
  
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true, message: 'Contact deleted' })
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app