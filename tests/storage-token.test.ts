import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock contract state
const contractState = {
  balances: new Map<string, number>(),
  totalSupply: 0,
  tokenUri: "https://example.com/storage-token-metadata"
};

// Mock contract calls
const mockContractCall = vi.fn((functionName: string, args: any[], sender: string) => {
  switch (functionName) {
    case 'mint':
      const [amount, recipient] = args;
      if (sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
        return { success: false, error: 100 }; // err-owner-only
      }
      contractState.balances.set(recipient, (contractState.balances.get(recipient) || 0) + amount);
      contractState.totalSupply += amount;
      return { success: true };
    case 'transfer':
      const [transferAmount, from, to] = args;
      if (sender !== from) {
        return { success: false, error: 101 }; // err-not-token-owner
      }
      const fromBalance = contractState.balances.get(from) || 0;
      if (fromBalance < transferAmount) {
        return { success: false, error: 1 }; // transfer-failed
      }
      contractState.balances.set(from, fromBalance - transferAmount);
      contractState.balances.set(to, (contractState.balances.get(to) || 0) + transferAmount);
      return { success: true };
    case 'get-balance':
      const [account] = args;
      return { success: true, value: contractState.balances.get(account) || 0 };
    case 'get-total-supply':
      return { success: true, value: contractState.totalSupply };
    case 'get-token-uri':
      return { success: true, value: contractState.tokenUri };
    case 'set-token-uri':
      const [newUri] = args;
      if (sender !== 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM') {
        return { success: false, error: 100 }; // err-owner-only
      }
      contractState.tokenUri = newUri;
      return { success: true };
    default:
      return { success: false, error: 'Unknown function' };
  }
});

describe('Storage Token Contract', () => {
  const contractOwner = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const user1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
  const user2 = 'ST3AM1A56AK2C1XAFJ4115ZSV26EB49BVQ10MGCS0';
  
  beforeEach(() => {
    contractState.balances.clear();
    contractState.totalSupply = 0;
    contractState.tokenUri = "https://example.com/storage-token-metadata";
    vi.clearAllMocks();
  });
  
  it('should mint tokens', () => {
    const result = mockContractCall('mint', [1000, user1], contractOwner);
    expect(result.success).toBe(true);
    expect(contractState.balances.get(user1)).toBe(1000);
    expect(contractState.totalSupply).toBe(1000);
  });
  
  it('should not allow non-owner to mint', () => {
    const result = mockContractCall('mint', [1000, user1], user1);
    expect(result.success).toBe(false);
    expect(result.error).toBe(100); // err-owner-only
  });
  
  it('should transfer tokens', () => {
    mockContractCall('mint', [1000, user1], contractOwner);
    const result = mockContractCall('transfer', [500, user1, user2], user1);
    expect(result.success).toBe(true);
    expect(contractState.balances.get(user1)).toBe(500);
    expect(contractState.balances.get(user2)).toBe(500);
  });
  
  it('should not transfer tokens if insufficient balance', () => {
    mockContractCall('mint', [1000, user1], contractOwner);
    const result = mockContractCall('transfer', [1500, user1, user2], user1);
    expect(result.success).toBe(false);
    expect(result.error).toBe(1); // transfer-failed
  });
  
  it('should get balance', () => {
    mockContractCall('mint', [1000, user1], contractOwner);
    const result = mockContractCall('get-balance', [user1], user1);
    expect(result.success).toBe(true);
    expect(result.value).toBe(1000);
  });
  
  it('should get total supply', () => {
    mockContractCall('mint', [1000, user1], contractOwner);
    mockContractCall('mint', [500, user2], contractOwner);
    const result = mockContractCall('get-total-supply', [], user1);
    expect(result.success).toBe(true);
    expect(result.value).toBe(1500);
  });
  
  it('should get token URI', () => {
    const result = mockContractCall('get-token-uri', [], user1);
    expect(result.success).toBe(true);
    expect(result.value).toBe("https://example.com/storage-token-metadata");
  });
  
  it('should set token URI', () => {
    const newUri = "https://example.com/new-metadata";
    const result = mockContractCall('set-token-uri', [newUri], contractOwner);
    expect(result.success).toBe(true);
    expect(contractState.tokenUri).toBe(newUri);
  });
  
  it('should not allow non-owner to set token URI', () => {
    const newUri = "https://example.com/new-metadata";
    const result = mockContractCall('set-token-uri', [newUri], user1);
    expect(result.success).toBe(false);
    expect(result.error).toBe(100); // err-owner-only
  });
});

