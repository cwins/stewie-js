// parser.ts — parse TSX source using TypeScript compiler API

import ts from 'typescript'

export interface ParsedFile {
  sourceFile: ts.SourceFile
  source: string
  filename: string
}

export function parseFile(source: string, filename: string): ParsedFile {
  const sourceFile = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  )

  return { sourceFile, source, filename }
}
