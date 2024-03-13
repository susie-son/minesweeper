import React from 'react'
import styled from 'styled-components'
import TileComponent, { Tile } from './Tile'

export class Position {
  row: number
  col: number

  constructor(row: number, col: number) {
    this.row = row
    this.col = col
  }

  getKey(): string {
    return `${this.row}_${this.col}`
  }
}

export class Board {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
  map: Map<String, Tile>

  // Create starting tile at the origin
  constructor() {
    this.minRow = 0
    this.maxRow = 0
    this.minCol = 0
    this.maxCol = 0

    this.map = new Map()
    this.addTile(new Position(0, 0), new Tile())
  }

  addTile(position: Position, tile: Tile) {
    this.minRow = Math.min(this.minRow, position.row)
    this.maxRow = Math.max(this.maxRow, position.row)
    this.minCol = Math.min(this.minCol, position.col)
    this.maxCol = Math.max(this.maxCol, position.col)
    this.map.set(position.getKey(), tile)
  }

  getTile(position: Position): Tile | undefined {
    return this.map.get(position.getKey())
  }

  hasTile(position: Position): boolean {
    return this.map.has(position.getKey())
  }

  generateGrid(): (Tile | undefined)[][] {
    let grid = Array<Array<Tile | undefined>>()

    for (let r = this.minRow; r <= this.maxRow; r++) {
      let rowArray = Array<Tile | undefined>()
      for (let c = this.minCol; c <= this.maxCol; c++) {
        const position = new Position(r, c)
        const tile = this.getTile(position)
        rowArray.push(tile)
      }
      grid.push(rowArray)
    }

    return grid
  }

  getNeighbourTypes(row: number, col: number): boolean[] {
    let neighbours: boolean[] = []
    const offsets = [-1, 0, 1]

    offsets.forEach((rowOffset) => {
      offsets.forEach((colOffset) => {
        if (rowOffset !== 0 || colOffset !== 0) {
          const neighbourPosition = new Position(row + rowOffset, col + colOffset)
          const tile = this.getTile(neighbourPosition)
          neighbours.push(!tile)
        }
      })
    })

    return neighbours
  }

  getScore(): number {
    let score = 0
    for (let r = this.minRow; r <= this.maxRow; r++) {
      for (let c = this.minCol; c <= this.maxCol; c++) {
        const position = new Position(r, c)
        const tile = this.getTile(position)
        if (tile && tile.isRevealed && !tile.isMine()) {
          score += tile.adjacentMines
        }
      }
    }
    return score
  }
}

const BoardWrapper = styled.div`
  display: flex;
  width: 100vw;
  height: 100vh;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  z-index: 1;
`

const RowWrapper = styled.div`
  display: flex;
`

interface BoardComponentProps {
  board: Board
  handleTileMouseDown: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, row: number, col: number) => void
  handleTileMouseUp: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, row: number, col: number) => void
}

const BoardComponent = ({ board, handleTileMouseDown, handleTileMouseUp }: BoardComponentProps) => {
  const grid: (Tile | undefined)[][] = board.generateGrid()

  return (
    <BoardWrapper>
      {grid.map((row, rowIndex: number) => {
        const adjustedRowIndex = rowIndex + board.minRow
        return (
          <RowWrapper key={adjustedRowIndex}>
            {row.map((tile, colIndex) => {
              const adjustedColIndex = colIndex + board.minCol
              return (
                <div
                  key={adjustedColIndex}
                  onMouseDown={(e) => handleTileMouseDown(e, adjustedRowIndex, adjustedColIndex)}
                  onMouseUp={(e) => handleTileMouseUp(e, adjustedRowIndex, adjustedColIndex)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <TileComponent
                    tile={tile}
                    neighbourTypes={board.getNeighbourTypes(adjustedRowIndex, adjustedColIndex)}
                  />
                </div>
              )
            })}
          </RowWrapper>
        )
      })}
    </BoardWrapper>
  )
}

export default BoardComponent
