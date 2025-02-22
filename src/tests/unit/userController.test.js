const { expect } = require('chai');
const sinon = require('sinon');
const { User } = require('../../models');
const UserController = require('../../controllers/userController');
const bcrypt = require('bcrypt');

describe('UserController', () => {
  let sandbox;
  
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
      };

      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub()
      };

      const createdUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User'
      };

      sandbox.stub(bcrypt, 'hash').resolves('hashedPassword');
      sandbox.stub(User, 'create').resolves(createdUser);

      await UserController.create(req, res);

      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledWith(createdUser)).to.be.true;
    });
  });
});
