import { MultiTenantSDK } from '../index';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MultiTenantSDK', () => {
  let sdk: MultiTenantSDK;

  beforeEach(() => {
    sdk = new MultiTenantSDK({
      baseURL: 'http://localhost:3000'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('auth', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        data: {
          token: 'test-token',
          user: {
            id: '123',
            email: 'test@example.com'
          }
        }
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() }
        }
      } as any);

      const response = await sdk.login({
        email: 'test@example.com',
        password: 'password123'
      });

      expect(response).toEqual(mockResponse.data);
    });
  });

  describe('users', () => {
    it('should get user details', async () => {
      const mockResponse = {
        data: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User'
        }
      };

      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() }
        }
      } as any);

      const response = await sdk.getUser('123');
      expect(response).toEqual(mockResponse.data);
    });
  });

  describe('tenants', () => {
    it('should create tenant', async () => {
      const mockResponse = {
        data: {
          id: '456',
          name: 'Test Tenant',
          slug: 'test-tenant'
        }
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
        interceptors: {
          request: { use: jest.fn() }
        }
      } as any);

      const response = await sdk.createTenant({
        name: 'Test Tenant'
      });

      expect(response).toEqual(mockResponse.data);
    });
  });
});
