import request from 'supertest';
import { expect } from 'chai';
import app from '../../app';
import { User } from '../../models';
import { createTestUser, generateAuthToken } from '../testHelpers';

describe('User API Integration Tests', () => {
  let testUser: any;
  let authToken: string;

  before(async () => {
    testUser = await createTestUser();
    authToken = await generateAuthToken(testUser);
  });

  after(async () => {
    await User.destroy({ where: {} });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'newuser@example.com',
          password: 'Password123!',
          name: 'New User'
        });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id');
      expect(res.body.email).to.equal('newuser@example.com');
    });

    it('should validate input', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'invalid-email',
          password: 'short',
          name: ''
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('message');
    });
  });
});