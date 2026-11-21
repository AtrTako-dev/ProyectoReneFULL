export class MySqlAuthRepository {
  constructor(executor) {
    this.executor = executor;
  }

  async transaction(action) {
    const connection = await this.executor.getConnection();
    try {
      await connection.beginTransaction();
      const result = await action(new MySqlAuthRepository(connection));
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async upsertBusinesses(businesses) {
    for (const business of businesses) {
      await this.executor.execute(
        `INSERT INTO businesses (id, name, is_reference_only)
         VALUES (?, ?, FALSE)
         ON DUPLICATE KEY UPDATE name = VALUES(name), is_reference_only = FALSE`,
        [String(business.id), business.name],
      );
    }
  }

  async findUserByEmail(email) {
    const [rows] = await this.executor.execute(
      `SELECT id, email, password_salt, password_hash, created_at
       FROM users WHERE email = ? LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findUserById(userId) {
    const [rows] = await this.executor.execute(
      `SELECT id, email, password_salt, password_hash, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [String(userId)],
    );
    return rows[0] ?? null;
  }

  async createUser(storageUser) {
    await this.executor.execute(
      `INSERT INTO users (id, email, password_salt, password_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(storageUser.id),
        storageUser.email,
        storageUser.passwordSalt,
        storageUser.passwordHash,
        new Date(storageUser.createdAt),
      ],
    );
  }

  async createBusiness(business) {
    await this.executor.execute(
      `INSERT INTO businesses (id, name, is_reference_only)
       VALUES (?, ?, FALSE)`,
      [String(business.id), business.name],
    );
  }

  async findBusiness(businessId) {
    const [rows] = await this.executor.execute(
      'SELECT id, name FROM businesses WHERE id = ? LIMIT 1',
      [String(businessId)],
    );
    return rows[0] ?? null;
  }

  async createMembership({ userId, businessId, role }) {
    await this.executor.execute(
      `INSERT INTO business_memberships (business_id, user_id, role)
       VALUES (?, ?, ?)`,
      [String(businessId), String(userId), role],
    );
  }

  async findMembership(userId, businessId) {
    const [rows] = await this.executor.execute(
      `SELECT business_id, user_id, role
       FROM business_memberships WHERE user_id = ? AND business_id = ? LIMIT 1`,
      [String(userId), String(businessId)],
    );
    return rows[0] ?? null;
  }

  async findSession(tokenHash) {
    const [rows] = await this.executor.execute(
      `SELECT s.user_id, s.expires_at, u.id, u.email, u.created_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? LIMIT 1`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async createSession({ tokenHash, userId, expiresAt }) {
    await this.executor.execute(
      `INSERT INTO user_sessions (token_hash, user_id, expires_at)
       VALUES (?, ?, ?)`,
      [tokenHash, String(userId), new Date(expiresAt)],
    );
  }

  async deleteSession(tokenHash) {
    await this.executor.execute('DELETE FROM user_sessions WHERE token_hash = ?', [tokenHash]);
  }

  async deleteExpiredSessions() {
    await this.executor.execute('DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
  }

  async listBusinessesForUser(userId) {
    const [rows] = await this.executor.execute(
      `SELECT b.id, b.name, m.role
       FROM business_memberships m
       JOIN businesses b ON b.id = m.business_id
       WHERE m.user_id = ?
       ORDER BY b.name`,
      [String(userId)],
    );
    return rows.map(row => ({ id: String(row.id), name: row.name, role: row.role }));
  }

  async listMembers(businessId) {
    const [rows] = await this.executor.execute(
      `SELECT u.id, u.email, u.created_at, m.role
       FROM business_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.business_id = ?
       ORDER BY u.email`,
      [String(businessId)],
    );
    return rows.map(row => ({
      id: String(row.id),
      email: row.email,
      createdAt: row.created_at,
      role: row.role,
    }));
  }
}
