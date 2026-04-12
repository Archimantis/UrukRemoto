const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('crypto');
const { query } = require('../db');

// Gera UUID simples compatível com Node sem dependência extra
const newUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
};

const sign = (user) =>
  jwt.sign({ uuid: user.uuid, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });

const saveRefreshToken = async (userUuid, deviceId) => {
  const token     = newUuid() + '-' + newUuid(); // token opaco suficiente
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 dias
  await query(
    `INSERT INTO public.refresh_tokens (uuid, user_uuid, token, device_id, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [newUuid(), userUuid, token, deviceId || 'unknown', expiresAt]
  );
  return token;
};

// POST /auth/register
const register = async (req, res, next) => {
  try {
    const { email, password, nome, device_id } = req.body;
    const existing = await query('SELECT uuid FROM public.users WHERE email=$1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'E-mail já cadastrado.' });

    const hash = await bcrypt.hash(password, 12);
    const uuid = newUuid();
    await query(
      'INSERT INTO public.users (uuid,email,password_hash,nome) VALUES ($1,$2,$3,$4)',
      [uuid, email, hash, nome || null]
    );
    const user = { uuid, email, nome };
    const refreshToken = await saveRefreshToken(uuid, device_id);
    res.status(201).json({ user, access_token: sign(user), refresh_token: refreshToken });
  } catch (err) { next(err); }
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { email, password, device_id } = req.body;
    const result = await query(
      'SELECT uuid,email,nome,password_hash FROM public.users WHERE email=$1', [email]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Credenciais inválidas.' });

    const user = result.rows[0];
    if (!await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: 'Credenciais inválidas.' });

    const { password_hash, ...safeUser } = user;
    const refreshToken = await saveRefreshToken(user.uuid, device_id);
    res.json({ user: safeUser, access_token: sign(safeUser), refresh_token: refreshToken });
  } catch (err) { next(err); }
};

// POST /auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refresh_token, device_id } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token obrigatório.' });

    const stored = await query(
      `SELECT rt.user_uuid, u.email, u.nome
       FROM public.refresh_tokens rt
       JOIN public.users u ON u.uuid = rt.user_uuid
       WHERE rt.token=$1 AND rt.expires_at > NOW()`,
      [refresh_token]
    );
    if (!stored.rows.length)
      return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });

    await query('DELETE FROM public.refresh_tokens WHERE token=$1', [refresh_token]);
    const { user_uuid, email, nome } = stored.rows[0];
    const user = { uuid: user_uuid, email, nome };
    const newRefresh = await saveRefreshToken(user_uuid, device_id);
    res.json({ access_token: sign(user), refresh_token: newRefresh });
  } catch (err) { next(err); }
};

// POST /auth/logout
const logout = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) await query('DELETE FROM public.refresh_tokens WHERE token=$1', [refresh_token]);
    res.json({ message: 'Logout realizado.' });
  } catch (err) { next(err); }
};

module.exports = { register, login, refresh, logout };
