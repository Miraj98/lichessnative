import * as util from './util'
import { Color, Key, Pieces } from './types'

type Mobility = (x1: number, y1: number, x2: number, y2: number) => boolean

function diff(a: number, b: number): number {
  return Math.abs(a - b)
}

function pawn(color: Color): Mobility {
  return (x1, y1, x2, y2) => diff(x1, x2) < 2 && (
    color === 'white' ? (
      // allow 2 squares from 1 and 8, for horde
      y2 === y1 + 1 || (y1 <= 2 && y2 === (y1 + 2) && x1 === x2)
    ) : (
      y2 === y1 - 1 || (y1 >= 7 && y2 === (y1 - 2) && x1 === x2)
    )
  )
}

const knight: Mobility = (x1, y1, x2, y2) => {
  const xd = diff(x1, x2)
  const yd = diff(y1, y2)
  return (xd === 1 && yd === 2) || (xd === 2 && yd === 1)
}

const bishop: Mobility = (x1, y1, x2, y2) => {
  return diff(x1, x2) === diff(y1, y2)
}

const rook: Mobility = (x1, y1, x2, y2) => {
  return x1 === x2 || y1 === y2
}

const queen: Mobility = (x1, y1, x2, y2) => {
  return bishop(x1, y1, x2, y2) || rook(x1, y1, x2, y2)
}

function king(color: Color, rookFiles: Set<number>, canCastle: boolean): Mobility {
  return (x1, y1, x2, y2)  => (
    diff(x1, x2) < 2 && diff(y1, y2) < 2
  ) || (
    canCastle && y1 === y2 && y1 === (color === 'white' ? 1 : 8) && (
      (x1 === 5 && (x2 === 3 || x2 === 7)) || rookFiles.has(x2)
    )
  )
}

function rookFilesOf(pieces: Pieces, color: Color) {
  const keys = Object.keys(pieces).filter(key => {
    const piece = pieces[key]
    return piece && piece.color === color && piece.role === 'rook'
  }).map((key: Key) => util.key2Coord(key)[0])

  return new Set(keys)
}

export default function premove(pieces: Pieces, key: Key, canCastle: boolean): Set<Key> {
  const piece = pieces[key], pos = util.key2Coord(key)
  if (piece === undefined) return new Set()

  let mobility: Mobility
  switch (piece.role) {
    case 'pawn':
      mobility = pawn(piece.color)
      break
    case 'knight':
      mobility = knight
      break
    case 'bishop':
      mobility = bishop
      break
    case 'rook':
      mobility = rook
      break
    case 'queen':
      mobility = queen
      break
    case 'king':
      mobility = king(piece.color, rookFilesOf(pieces, piece.color), canCastle)
      break
  }
  const keys = util.allKeys.map(util.key2Coord).filter(pos2 => {
    return (pos[0] !== pos2[0] || pos[1] !== pos2[1]) && mobility(pos[0], pos[1], pos2[0], pos2[1])
  }).map(util.coord2Key)

  return new Set(keys)
}
