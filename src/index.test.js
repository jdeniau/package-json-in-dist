import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Mock the fs module
vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
}));

// Mock path.resolve to return predictable paths
vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    default: {
      ...actual.default,
      resolve: vi.fn((...args) => {
        if (args.length === 1) {
          return args[0];
        }

        return actual.default.join(...args);
      }),
    },
  };
});

describe('package-json-in-dist', () => {
  let originalArgv;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    originalArgv = process.argv;
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  const runScript = async (packageJson, distDir = 'dist') => {
    process.argv = ['node', 'index.js', distDir];

    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(packageJson));

    await import('./index.js');

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    return writeCall ? JSON.parse(writeCall[1]) : null;
  };

  it('should create a package.json in the dist folder', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      exports: {
        '.': {
          default: 'dist/index.js',
        },
      },
    };

    await runScript(originalPackage);

    expect(fs.mkdirSync).toHaveBeenCalledWith('dist/', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'dist/package.json',
      expect.any(String)
    );
  });

  it("should remove the 'dist/' prefix from main and types paths", async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      private: false,
      main: 'index.js',
      types: 'index.d.ts',
    });
  });

  it('should make the package public', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      private: true,
      main: 'dist/index.js',
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      private: false,
      main: 'index.js',
    });
  });

  it("should remove the 'dist/' prefix from exports", async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      exports: {
        '.': {
          default: 'dist/index.js',
        },
        './utils': {
          default: 'dist/utils.js',
        },
      },
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      private: false,
      exports: {
        '.': 'index.js',
        './utils': 'utils.js',
      },
    });
  });

  it('should remove the development key from exports', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      exports: {
        '.': {
          development: 'src/index.js',
          default: 'dist/index.js',
        },
        './utils': {
          development: 'src/utils.js',
          default: 'dist/utils.js',
        },
      },
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      private: false,
      exports: {
        '.': 'index.js',
        './utils': 'utils.js',
      },
    });
  });

  it('should handle exports with multiple conditions', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      exports: {
        '.': {
          import: 'dist/index.mjs',
          require: 'dist/index.cjs',
        },
      },
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage.exports['.']).toEqual({
      import: 'index.mjs',
      require: 'index.cjs',
    });
  });

  it('should remove files, scripts and devDependencies keys', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      main: 'dist/index.js',
      files: ['dist'],
      scripts: {
        build: 'tsc',
        test: 'vitest',
      },
      devDependencies: {
        typescript: '^5.0.0',
        vitest: '^1.0.0',
      },
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      private: false,
      main: 'index.js',
    });
  });

  it('should use a custom dist folder', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      main: 'build/index.js',
    };

    const newPackage = await runScript(originalPackage, 'build');

    expect(fs.mkdirSync).toHaveBeenCalledWith('build/', { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'build/package.json',
      expect.any(String)
    );
    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      private: false,
      main: 'index.js',
    });
  });

  it('should add a trailing slash to the dist folder if missing', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      main: 'dist/index.js',
    };

    await runScript(originalPackage, 'dist');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      'dist/package.json',
      expect.any(String)
    );
  });

  it('should preserve other package.json properties', async () => {
    const originalPackage = {
      name: 'test-package',
      version: '1.0.0',
      description: 'A test package',
      author: 'Test Author',
      license: 'MIT',
      main: 'dist/index.js',
      dependencies: {
        'some-lib': '^1.0.0',
      },
    };

    const newPackage = await runScript(originalPackage);

    expect(newPackage).toEqual({
      name: 'test-package',
      version: '1.0.0',
      description: 'A test package',
      author: 'Test Author',
      license: 'MIT',
      private: false,
      main: 'index.js',
      dependencies: { 'some-lib': '^1.0.0' },
    });
  });
});
