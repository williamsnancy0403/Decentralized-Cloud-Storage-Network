import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock contract state
const contractState = {
  fileStorage: new Map<string, any>(),
  storageProviders: new Map<string, any>(),
  paymentInterval: 144,
};

// Mock contract calls
const mockContractCall = vi.fn((functionName: string, args: any[], sender: string) => {
  switch (functionName) {
    case 'register-storage-provider':
      const [availableSpace, pricePerBlock] = args;
      contractState.storageProviders.set(sender, { availableSpace, pricePerBlock });
      return { success: true };
    case 'store-file':
      const [fileId, size, storageProvider, encryptedLocation] = args;
      const provider = contractState.storageProviders.get(storageProvider);
      if (!provider || provider.availableSpace < size) {
        return { success: false, error: 103 }; // err-insufficient-funds
      }
      contractState.fileStorage.set(fileId, {
        owner: sender,
        size,
        storageProvider,
        encryptedLocation,
        lastPaymentHeight: 0,
      });
      provider.availableSpace -= size;
      return { success: true };
    case 'retrieve-file':
      const [retrieveFileId] = args;
      const file = contractState.fileStorage.get(retrieveFileId);
      if (!file || file.owner !== sender) {
        return { success: false, error: 101 }; // err-not-file-owner
      }
      return { success: true, value: file.encryptedLocation };
    case 'delete-file':
      const [deleteFileId] = args;
      const deleteFile = contractState.fileStorage.get(deleteFileId);
      if (!deleteFile || deleteFile.owner !== sender) {
        return { success: false, error: 101 }; // err-not-file-owner
      }
      const deleteProvider = contractState.storageProviders.get(deleteFile.storageProvider);
      deleteProvider.availableSpace += deleteFile.size;
      contractState.fileStorage.delete(deleteFileId);
      return { success: true };
    case 'process-payment':
      const [paymentFileId] = args;
      const paymentFile = contractState.fileStorage.get(paymentFileId);
      if (!paymentFile) {
        return { success: false, error: 102 }; // err-file-not-found
      }
      paymentFile.lastPaymentHeight = 100; // Mock block height
      return { success: true };
    case 'get-file-info':
      const [infoFileId] = args;
      const fileInfo = contractState.fileStorage.get(infoFileId);
      return fileInfo ? { success: true, value: fileInfo } : { success: false, error: 102 }; // err-file-not-found
    case 'get-storage-provider-info':
      const [providerAddress] = args;
      const providerInfo = contractState.storageProviders.get(providerAddress);
      return providerInfo ? { success: true, value: providerInfo } : { success: false, error: 104 }; // err-provider-not-found
    default:
      return { success: false, error: 'Unknown function' };
  }
});

describe('Decentralized Storage Contract', () => {
  const contractOwner = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const user1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const user2 = 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0';
  
  beforeEach(() => {
    contractState.fileStorage.clear();
    contractState.storageProviders.clear();
    contractState.paymentInterval = 144;
    vi.clearAllMocks();
  });
  
  it('should register storage provider', () => {
    const result = mockContractCall('register-storage-provider', [1000000, 10], user1);
    expect(result.success).toBe(true);
    expect(contractState.storageProviders.get(user1)).toEqual({ availableSpace: 1000000, pricePerBlock: 10 });
  });
  
  it('should store file', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    const result = mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    expect(result.success).toBe(true);
    expect(contractState.fileStorage.get('file123')).toBeDefined();
    expect(contractState.storageProviders.get(user1)?.availableSpace).toBe(999000);
  });
  
  it('should not store file if insufficient space', () => {
    mockContractCall('register-storage-provider', [500, 10], user1);
    const result = mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    expect(result.success).toBe(false);
    expect(result.error).toBe(103); // err-insufficient-funds
  });
  
  it('should retrieve file', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    const result = mockContractCall('retrieve-file', ['file123'], user2);
    expect(result.success).toBe(true);
    expect(result.value).toBe('encrypted-location-hash');
  });
  
  it('should not retrieve file if not owner', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    const result = mockContractCall('retrieve-file', ['file123'], user1);
    expect(result.success).toBe(false);
    expect(result.error).toBe(101); // err-not-file-owner
  });
  
  it('should delete file', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    const result = mockContractCall('delete-file', ['file123'], user2);
    expect(result.success).toBe(true);
    expect(contractState.fileStorage.get('file123')).toBeUndefined();
    expect(contractState.storageProviders.get(user1)?.availableSpace).toBe(1000000);
  });
  
  it('should process payment', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    const result = mockContractCall('process-payment', ['file123'], contractOwner);
    expect(result.success).toBe(true);
    expect(contractState.fileStorage.get('file123')?.lastPaymentHeight).toBe(100);
  });
  
  it('should get file info', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    mockContractCall('store-file', ['file123', 1000, user1, 'encrypted-location-hash'], user2);
    const result = mockContractCall('get-file-info', ['file123'], user2);
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      owner: user2,
      size: 1000,
      storageProvider: user1,
      encryptedLocation: 'encrypted-location-hash',
      lastPaymentHeight: 0,
    });
  });
  
  it('should get storage provider info', () => {
    mockContractCall('register-storage-provider', [1000000, 10], user1);
    const result = mockContractCall('get-storage-provider-info', [user1], user2);
    expect(result.success).toBe(true);
    expect(result.value).toEqual({ availableSpace: 1000000, pricePerBlock: 10 });
  });
});

