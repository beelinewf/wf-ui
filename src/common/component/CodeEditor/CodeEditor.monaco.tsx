import React, { useEffect, useId, useState } from 'react';

import { Editor, loader, type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker';

import type { CodeEditorLanguage } from './CodeEditor.types';

self.MonacoEnvironment = {
	getWorker: (_workerId, label) => {
		if (label === 'json') return new JsonWorker();
		if (label === 'typescript' || label === 'javascript') return new TsWorker();
		return new EditorWorker();
	},
};

loader.config({ monaco });

// Scripts are function bodies, so a top-level `return` (TS1108) is valid here.
monaco.typescript.javascriptDefaults.setDiagnosticsOptions({ diagnosticCodesToIgnore: [1108] });
monaco.typescript.javascriptDefaults.setCompilerOptions({
	target: monaco.typescript.ScriptTarget.ES2020,
	allowNonTsExtensions: true,
	lib: ['es2020'],
});
monaco.typescript.javascriptDefaults.addExtraLib(
	[
		'/** Script: value at input_data. Input validation: raw payload string. */',
		'declare const input: any;',
		'/** Post-script: the native node output. */',
		'declare const output: any;',
		'/** Poller until: the normalized response. */',
		'declare const response: { body: any; headers?: Record<string, any>; status?: number };',
	].join('\n'),
	'beeline-globals.d.ts',
);

// `context` lives in a lib of its own so one editor can swap in a richer declaration. Extra libs are global to every
// JS model, so the lib follows focus: the focused editor's declaration is active, and the generic one comes back on
// blur or unmount. Re-adding a lib under the same path replaces it in place, so there is never a moment without one.
const CONTEXT_LIB_PATH = 'beeline-context.d.ts';
const DEFAULT_CONTEXT_LIB = [
	'/** Workflow context. Mutable in script nodes, frozen in conditions, predicates and validation. */',
	'declare const context: Record<string, any>;',
].join('\n');

let contextLibOwner: string | null = null;

const claimContextLib = (owner: string, lib: string) => {
	contextLibOwner = owner;
	monaco.typescript.javascriptDefaults.addExtraLib(lib, CONTEXT_LIB_PATH);
};

const releaseContextLib = (owner: string) => {
	// Another editor took focus first; its declaration stays.
	if (contextLibOwner !== owner) return;
	contextLibOwner = null;
	monaco.typescript.javascriptDefaults.addExtraLib(DEFAULT_CONTEXT_LIB, CONTEXT_LIB_PATH);
};

monaco.typescript.javascriptDefaults.addExtraLib(DEFAULT_CONTEXT_LIB, CONTEXT_LIB_PATH);

// Monaco's JSON diagnostics options are global, so every mounted editor's schema is kept here and re-applied as one
// list. Each entry is scoped by `fileMatch` to that editor's own model URI, so other JSON editors are unaffected.
const jsonSchemas = new Map<string, object>();

const applyJsonSchemas = () =>
	monaco.json.jsonDefaults.setDiagnosticsOptions({
		...monaco.json.jsonDefaults.diagnosticsOptions,
		validate: true,
		enableSchemaRequest: false,
		schemas: [...jsonSchemas].map(([modelUri, schema]) => ({
			uri: `${modelUri}.schema`,
			fileMatch: [modelUri],
			schema,
		})),
	});

interface CodeEditorMonacoProps {
	value: string;
	onChange?: (value: string) => void;
	language: CodeEditorLanguage;
	height: number | string;
	readOnly?: boolean;
	placeholder?: string;
	jsonSchema?: object;
	extraLib?: string;
}

const CodeEditorMonaco: React.FC<CodeEditorMonacoProps> = ({
	value,
	onChange,
	language,
	height,
	readOnly,
	placeholder,
	jsonSchema,
	extraLib,
}) => {
	// A model URI of its own, so a schema applies to this editor only (an expanded copy gets another one).
	const id = useId().replace(/[^a-zA-Z0-9]/g, '');
	const modelUri = monaco.Uri.from({ scheme: 'inmemory', path: `/code-editor/${id}.json` }).toString();
	const scoped = !!jsonSchema && language === 'json';

	useEffect(() => {
		if (!scoped) return;
		jsonSchemas.set(modelUri, jsonSchema);
		applyJsonSchemas();
		return () => {
			jsonSchemas.delete(modelUri);
			applyJsonSchemas();
		};
	}, [modelUri, jsonSchema, scoped]);

	const [focused, setFocused] = useState(false);
	const contextLib = language === 'javascript' && focused ? extraLib : undefined;

	// Claimed while focused and re-claimed when the declaration changes under the cursor (a debug run is picked).
	useEffect(() => {
		if (!contextLib) return;
		claimContextLib(id, contextLib);
		return () => releaseContextLib(id);
	}, [id, contextLib]);

	const handleMount: OnMount = (editor) => {
		editor.onDidFocusEditorText(() => setFocused(true));
		editor.onDidBlurEditorText(() => setFocused(false));
		// The model may mount already focused (the expanded copy grabs focus on open).
		if (editor.hasTextFocus()) setFocused(true);
	};

	return (
		<Editor
			// Editors without a schema keep Monaco's default model URI.
			path={scoped ? modelUri : undefined}
			value={value}
			onChange={(next) => onChange?.(next ?? '')}
			language={language}
			height={height}
			onMount={handleMount}
			theme="vs"
			options={{
				readOnly,
				placeholder,
				fontSize: 13,
				tabSize: 2,
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				wordWrap: 'on',
				lineNumbersMinChars: 3,
				folding: false,
				glyphMargin: false,
				renderLineHighlight: 'none',
				overviewRulerLanes: 0,
				hideCursorInOverviewRuler: true,
				scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8, alwaysConsumeMouseWheel: false },
				padding: { top: 8, bottom: 8 },
				automaticLayout: true,
				fixedOverflowWidgets: true,
			}}
		/>
	);
};

export default CodeEditorMonaco;
