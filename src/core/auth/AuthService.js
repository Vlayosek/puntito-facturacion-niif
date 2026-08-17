/**
 * AuthService — Logica de autenticacion JWT para Puntito SaaS
 * Maneja login, hash de contrasenas, generacion y verificacion de tokens.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'puntitodb'
});

const JWT_SECRET = process.env.JWT_SECRET || 'puntito-saas-jwt-secret-2026-cambiar-en-produccion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const SALT_ROUNDS = 10;

export class AuthService {
  /**
   * Autentica un usuario y retorna un JWT firmado
   * @param {string} usuario
   * @param {string} password - contrasena en texto plano
   * @returns {Promise<{token: string, user: object}>}
   */
  static async login(usuario, password) {
    if (!usuario || !password) {
      throw new Error('Usuario y contrasena son requeridos');
    }

    const res = await pool.query(
      `SELECT u.id_usuario, u.id_cliente, u.usuario, u.nombre, u.email, u.password_hash, u.estado,
              c.razon_social as empresa_nombre, c.ruc as empresa_ruc
       FROM puntito.tbs_usuario u
       JOIN puntito.tbm_cliente c ON u.id_cliente = c.id_cliente
       WHERE u.usuario = $1 AND u.estado = TRUE`,
      [usuario.toLowerCase().trim()]
    );

    if (res.rowCount === 0) {
      throw new Error('Usuario o contrasena incorrectos');
    }

    const user = res.rows[0];

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new Error('Usuario o contrasena incorrectos');
    }

    const payload = {
      idUsuario: user.id_usuario,
      idCliente: user.id_cliente,
      usuario: user.usuario,
      nombre: user.nombre,
      email: user.email,
      empresaNombre: user.empresa_nombre,
      empresaRuc: user.empresa_ruc
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      expiresIn: JWT_EXPIRES_IN,
      user: {
        idUsuario: user.id_usuario,
        idCliente: user.id_cliente,
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.email,
        empresaNombre: user.empresa_nombre,
        empresaRuc: user.empresa_ruc
      }
    };
  }

  /**
   * Verifica un token JWT y retorna el payload
   * @param {string} token
   * @returns {{idUsuario, idCliente, usuario, nombre, empresaNombre, empresaRuc}}
   */
  static verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new Error('Sesion expirada. Por favor inicia sesion nuevamente.');
      }
      throw new Error('Token invalido. Por favor inicia sesion nuevamente.');
    }
  }

  /**
   * Crea un nuevo usuario para una empresa
   * @param {object} userData - { idCliente, usuario, nombre, email, password }
   * @returns {Promise<{idUsuario: number}>}
   */
  static async createUser({ idCliente, usuario, nombre, email, password }) {
    if (!usuario || !password || !nombre || !idCliente) {
      throw new Error('Campos requeridos: idCliente, usuario, nombre, password');
    }

    const hash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      const res = await pool.query(
        `INSERT INTO puntito.tbs_usuario (id_cliente, usuario, nombre, email, password_hash, estado)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id_usuario`,
        [idCliente, usuario.toLowerCase().trim(), nombre.trim(), (email || '').trim(), hash]
      );
      return { idUsuario: res.rows[0].id_usuario };
    } catch (err) {
      if (err.code === '23505') { // unique violation
        throw new Error(`El usuario '${usuario}' ya existe en esta empresa`);
      }
      throw err;
    }
  }

  /**
   * Cambia la contrasena de un usuario
   * @param {number} idUsuario
   * @param {string} passwordActual
   * @param {string} passwordNueva
   */
  static async changePassword(idUsuario, passwordActual, passwordNueva) {
    const res = await pool.query(
      'SELECT password_hash FROM puntito.tbs_usuario WHERE id_usuario = $1 AND estado = TRUE',
      [idUsuario]
    );
    if (res.rowCount === 0) throw new Error('Usuario no encontrado');

    const isValid = await bcrypt.compare(passwordActual, res.rows[0].password_hash);
    if (!isValid) throw new Error('La contrasena actual no es correcta');

    if (passwordNueva.length < 8) throw new Error('La nueva contrasena debe tener al menos 8 caracteres');

    const newHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    await pool.query(
      'UPDATE puntito.tbs_usuario SET password_hash = $1 WHERE id_usuario = $2',
      [newHash, idUsuario]
    );
  }

  /**
   * Lista los usuarios de una empresa
   * @param {number} idCliente
   */
  static async listUsers(idCliente) {
    const res = await pool.query(
      `SELECT id_usuario, usuario, nombre, email, estado, date_create
       FROM puntito.tbs_usuario WHERE id_cliente = $1 ORDER BY nombre`,
      [idCliente]
    );
    return res.rows;
  }
}
