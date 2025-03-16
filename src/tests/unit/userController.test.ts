import { expect } from 'chai';
import sinon from 'sinon';
import { Request, Response } from 'express';
import { User } from '../../models';
import UserController from '../../controllers/userController';
import bcrypt from 'bcrypt';

describe('UserController', () => {
  let sandbox: sinon.SinonSandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const req = {
        body: {
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User'
        }
      } as Request;

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
      } as unknown as Response;

      const createdUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User'
      };

      sandbox.stub(bcrypt, 'hash').resolves('hashedPassword');
      sandbox.stub(User, 'create').resolves(createdUser);

      await UserController.create(req, res, () => {});

      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledWith(createdUser)).to.be.true;
    });
  });
});