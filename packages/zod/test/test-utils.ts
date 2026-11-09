import {
	type JSONSchema,
	Meta,
	parse,
	type ParsedJSONSchemaObject,
} from '@utilize/json-schema';
import { type z } from 'zod';

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { generate } from '../src/generator';
import { format } from '../src/utils';

/**
 * A tagged template literal function that formats TypeScript code.
 */
export const ts = (strings: TemplateStringsArray, ...values: unknown[]) => {
	const rawString = String.raw(strings, ...values);
	return format(rawString);
};

export function withMeta(obj: JSONSchema, meta: Partial<Meta> = {}) {
	Object.defineProperty(obj, Meta, {
		enumerable: false,
		value: { ...meta },
		writable: true,
		configurable: true,
	});
	return obj as ParsedJSONSchemaObject;
}

export interface CompileOptions {
	importZod?: boolean;
	cwd?: string;
	fileName?: string;
}

export async function compile(schema: JSONSchema, options?: CompileOptions) {
	const parsed = await parse(schema, {
		cwd: options?.cwd ?? __dirname + '/',
		fileName: options?.fileName ?? 'Root.json',
	});
	const code = generate(parsed.root, {
		importZod: options?.importZod ?? false,
	});
	return format(code);
}

/**
 * Compiles the schema, runs the generated module and returns its `Root` zod
 * schema. The module is written next to the tests, so `zod` resolves from
 * this package, and removed after it is loaded.
 */
export async function compileToZod(schema: JSONSchema): Promise<z.ZodType> {
	const code = await compile(schema, { importZod: true });
	const directory = await mkdtemp(join(__dirname, '__generated__-'));

	try {
		const filePath = join(directory, 'schema.ts');
		await writeFile(filePath, code);
		const module = (await import(filePath)) as { Root: z.ZodType };
		return module.Root;
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}
