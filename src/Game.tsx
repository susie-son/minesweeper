import { useEffect, useRef, useState } from 'react'
import BoardComponent, { Board, Position } from './Board'
import React from 'react'
import { Tile } from './Tile'
import styled from 'styled-components'
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { distanceCap, maxProbability, minProbability } from './constants'

const GameWrapper = styled.div`
  position: relative;
  background: linear-gradient(to right bottom, #e4f9fd, #cdecff, #f2e2ff);
`

const ScoreWrapper = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  font-family: 'Madimi One', sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 70pt;
  color: white;
  padding: 50px;
  background: rgba(0, 0, 0, 0.1);
  z-index: 2;
  cursor: pointer;
`

const Game = () => {
  const [board, setBoard] = useState(new Board())
  const [mouseButtons, setMouseButtons] = useState(0)
  const transformComponentRef = useRef<ReactZoomPanPinchRef>(null)
  const [score, setScore] = useState(0)

  // Returns whether a mine should be generated based on position
  const generateMine = (position: Position): boolean => {
    const { row, col } = position

    // Calculate the distance from the origin
    const distance = Math.sqrt(row ** 2 + col ** 2)

    // Avoid placing mines too close to the origin
    if (distance <= Math.sqrt(2)) return false

    // Calculate probability based on distance
    let probability =
      minProbability + (Math.min(distance, distanceCap) / distanceCap) * (maxProbability - minProbability)
    return Math.random() < probability
  }

  const handleTileMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, row: number, col: number) => {
    if (e.buttons === 2) {
      toggleFlag(row, col)
    }
    setMouseButtons(e.buttons)
  }

  const handleTileMouseUp = (e: React.MouseEvent<HTMLDivElement, MouseEvent>, row: number, col: number) => {
    if (mouseButtons === 1 && e.buttons === 0) {
      revealTile(row, col)
    } else if (mouseButtons === 3) {
      handleChord(row, col)
    }
    setMouseButtons(0)
  }

  const expandBoard = (board: Board, row: number, col: number) => {
    let newBoard: Board = Object.assign(board)
    let queue: Position[] = []

    let offsets = [-1, 0, 1]

    // Iterate through neighbouring tiles
    offsets.forEach((i) => {
      offsets.forEach((j) => {
        if (i !== 0 || j !== 0) {
          const newRow = row + i
          const newCol = col + j
          const newPosition = new Position(newRow, newCol)

          // If no tile exists at this position, mark it for expansion
          if (!newBoard.hasTile(newPosition)) {
            queue.push(newPosition)
          }
        }
      })
    })

    // Add new tiles or update existing ones based on mine generation logic
    queue.forEach((position) => {
      // Use 9 to indicate a mine, otherwise use 0 to indicate an initially empty tile
      const newTile = new Tile(generateMine(position) ? 9 : 0)
      newBoard.addTile(position, newTile)
    })

    // After all tiles are placed or updated, count the adjacent mines for each
    newBoard.map.forEach((tile, key) => {
      if (!tile.isMine()) {
        let mineCount = 0
        const [row, col] = key.split('_').map(Number)

        // Count mines around this tile
        offsets.forEach((i) => {
          offsets.forEach((j) => {
            if (i !== 0 || j !== 0) {
              const neighbourPosition = new Position(row + i, col + j)
              const neighbourTile = newBoard.getTile(neighbourPosition)
              if (neighbourTile && neighbourTile.isMine()) {
                mineCount++
              }
            }
          })
        })
        tile.adjacentMines = mineCount
      }
    })

    return newBoard
  }

  const revealAdjacentTiles = (board: Board, row: number, col: number): Board => {
    let newBoard: Board = Object.assign(board)
    let queue = [[row, col]]

    // BFS to reveal all connected empty tiles
    while (queue.length) {
      let [currentRow, currentCol] = queue.shift()!

      let offsets = [-1, 0, 1]

      // Check adjacent tiles for expansion
      offsets.forEach((i) => {
        offsets.forEach((j) => {
          if (i !== 0 || j !== 0) {
            let newRow = currentRow + i
            let newCol = currentCol + j
            let newPosition = new Position(newRow, newCol)

            // Expand the board around this new position
            newBoard = expandBoard(newBoard, newRow, newCol)

            const adjacentTile = newBoard.getTile(newPosition)

            if (adjacentTile && !adjacentTile.isRevealed && !adjacentTile.isMine() && !adjacentTile.isFlagged) {
              // Reveal this adjacent tile
              adjacentTile.isRevealed = true
              newBoard.addTile(newPosition, adjacentTile)

              // If the adjacent tile is also empty, add to the queue to reveal its adjacent tiles
              if (adjacentTile.isEmpty()) {
                queue.push([newRow, newCol])
              }
            }
          }
        })
      })
    }

    return newBoard
  }

  const revealTile = (row: number, col: number) => {
    const position = new Position(row, col)
    const tile = board.getTile(position)

    // If the tile is already revealed or is flagged, then do nothing
    if (!tile || tile.isRevealed || tile.isFlagged) {
      return
    }

    let newBoard: Board = Object.assign(board)
    newBoard = expandBoard(newBoard, row, col)

    // Reveal the clicked tile
    tile.isRevealed = true
    newBoard.addTile(position, tile)

    if (tile.isMine()) {
      // TODO: Handle the "game over" scenario
    } else if (tile.isEmpty()) {
      // If the clicked tile is empty, reveal adjacent tiles
      newBoard = revealAdjacentTiles(newBoard, row, col)
    }

    setBoard(newBoard)
  }

  const toggleFlag = (row: number, col: number) => {
    const position = new Position(row, col)

    // If the tile is revealed, then do nothing
    const tile = board.getTile(position)
    if (!tile || tile.isRevealed) {
      return
    }

    let newBoard: Board = Object.assign(board)
    tile.isFlagged = !tile.isFlagged
    newBoard.addTile(position, tile)

    setBoard(newBoard)
  }

  const handleChord = (row: number, col: number) => {
    const position = new Position(row, col)
    const tile = board.getTile(position)

    const offsets = [-1, 0, 1]

    // If the tile doesn't exist or is not revealed, then do nothing
    if (!tile || !tile.isRevealed) {
      return
    }

    // Count the number of adjacent flagged tiles and revealed mines
    let flaggedAdjacent = 0
    offsets.forEach((i) => {
      offsets.forEach((j) => {
        if (i !== 0 || j !== 0) {
          const newRow = row + i
          const newCol = col + j
          const newPosition = new Position(newRow, newCol)
          const newTile = board.getTile(newPosition)
          if (newTile && (newTile.isFlagged || (newTile.isRevealed && newTile.isMine()))) {
            flaggedAdjacent++
          }
        }
      })
    })

    // If the number of adjacent flags matches the number of adjacent mines, reveal adjacent tiles
    if (flaggedAdjacent === tile.adjacentMines) {
      offsets.forEach((i) => {
        offsets.forEach((j) => {
          if (i !== 0 || j !== 0) {
            const newRow = row + i
            const newCol = col + j
            const newPosition = new Position(newRow, newCol)
            const newTile = board.getTile(newPosition)
            if (newTile && !newTile.isRevealed && !newTile.isFlagged) {
              revealTile(newRow, newCol)
            }
          }
        })
      })
    }
  }

  const resetPosition = () => {
    if (transformComponentRef.current) {
      const { resetTransform } = transformComponentRef.current
      resetTransform()
    }
  }

  useEffect(() => {
    setScore(board.getScore())
  })

  return (
    <GameWrapper>
      <ScoreWrapper onClick={resetPosition}>{score}</ScoreWrapper>
      <TransformWrapper
        ref={transformComponentRef}
        limitToBounds={false}
        minScale={0.5}
        maxScale={2}
        panning={{ allowLeftClickPan: false, allowRightClickPan: false }}
        pinch={{ disabled: true }}
        doubleClick={{ disabled: true }}
      >
        <TransformComponent>
          <BoardComponent
            board={board}
            handleTileMouseDown={handleTileMouseDown}
            handleTileMouseUp={handleTileMouseUp}
          />
        </TransformComponent>
      </TransformWrapper>
    </GameWrapper>
  )
}

export default Game
