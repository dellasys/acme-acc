import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('ReportsService', () => {
  let service: ReportsService;
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;

  function setupMockFs({
    files = ['file1.csv', 'file2.csv', 'file3.csv'],
    readFileData = '2023-01-01,Cash,,100,0',
    writeFileError = null,
    readFileError = null,
  }: {
    files?: string[];
    readFileData?: string;
    writeFileError?: Error | null;
    readFileError?: Error | null;
  } = {}) {
    mockFs.readdirSync.mockReturnValue(files as any);
    mockFs.promises = {
      readFile: readFileError
        ? jest.fn().mockRejectedValue(readFileError)
        : jest.fn().mockResolvedValue(readFileData),
      writeFile: writeFileError
        ? jest.fn().mockRejectedValue(writeFileError)
        : jest.fn().mockResolvedValue(undefined),
    } as any;
    mockPath.join.mockImplementation((...args) => args.join('/'));
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService],
    }).compile();
    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
    setupMockFs();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('state', () => {
    it('should return idle state initially', () => {
      expect(service.state('accounts')).toBe('idle');
      expect(service.state('yearly')).toBe('idle');
      expect(service.state('fs')).toBe('idle');
    });
  });

  describe('accounts', () => {
    it('should process accounts report successfully', async () => {
      setupMockFs({ readFileData: '2023-01-01,Cash,,100,0\n2023-01-02,Accounts Receivable,,50,0' });
      await service.accounts();
      expect(service.state('accounts')).toContain('finished in');
      expect(mockFs.promises.readFile).toHaveBeenCalledTimes(3);
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('out/accounts.csv', expect.any(String));
    });

    it('should handle file read errors', async () => {
      setupMockFs({ readFileError: new Error('File read error') });
      await expect(service.accounts()).rejects.toThrow('File read error');
    });

    it('should handle empty files', async () => {
      setupMockFs({ readFileData: '' });
      await service.accounts();
      expect(service.state('accounts')).toContain('finished in');
    });
  });

  describe('yearly', () => {
    it('should process yearly report successfully', async () => {
      setupMockFs({ readFileData: '2023-01-01,Cash,,100,0\n2023-01-02,Cash,,50,0' });
      await service.yearly();
      expect(service.state('yearly')).toContain('finished in');
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('out/yearly.csv', expect.any(String));
    });

    it('should exclude yearly.csv from processing', async () => {
      setupMockFs({ files: ['file1.csv', 'yearly.csv', 'file2.csv'] });
      await service.yearly();
      expect(mockFs.promises.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('fs', () => {
    it('should process financial statement report successfully', async () => {
      setupMockFs({ readFileData: '2023-01-01,Cash,,100,0\n2023-01-02,Sales Revenue,,50,0' });
      await service.fs();
      expect(service.state('fs')).toContain('finished in');
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('out/fs.csv', expect.any(String));
    });

    it('should exclude fs.csv from processing', async () => {
      setupMockFs({ files: ['file1.csv', 'fs.csv', 'file2.csv'] });
      await service.fs();
      expect(mockFs.promises.readFile).toHaveBeenCalledTimes(2);
    });

    it('should handle accounts not in predefined categories', async () => {
      setupMockFs({ readFileData: '2023-01-01,Unknown Account,,100,0' });
      await service.fs();
      expect(service.state('fs')).toContain('finished in');
    });
  });

  describe('parallel processing', () => {
    it('should process multiple files in parallel', async () => {
      setupMockFs();
      const start = Date.now();
      await Promise.all([
        service.accounts(),
        service.yearly(),
        service.fs(),
      ]);
      const duration = Date.now() - start;
      expect(service.state('accounts')).toContain('finished');
      expect(service.state('yearly')).toContain('finished');
      expect(service.state('fs')).toContain('finished');
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory not found');
      });
      await expect(service.accounts()).rejects.toThrow('Directory not found');
    });

    it('should handle write file errors', async () => {
      setupMockFs({ writeFileError: new Error('Write error') });
      await expect(service.accounts()).rejects.toThrow('Write error');
    });
  });
});
