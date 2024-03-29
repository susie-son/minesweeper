import { useCallback, useMemo, useRef, useState } from 'react'
import BoardComponent from '../board/BoardComponent'
import { Board } from '../../Board'
import { Position } from '../../Position'
import React from 'react'
import { Tile } from '../../Tile'
import { ReactZoomPanPinchRef, TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch'
import { DISTANCE_MINE_CAP, PROBABILITY_MINE_MAX, PROBABILITY_MINE_MIN } from '../../constants'
import { GameWrapper } from './GameWrapper'
import { ScoreWrapper } from './ScoreWrapper'

const GameComponent = () => {
  const [board, setBoard] = useState(() => {
    let newBoard = new Board()
    return revealTile(newBoard, 0, 0)
  })
  const [mouseButtons, setMouseButtons] = useState(0)
  const transformComponentRef = useRef<ReactZoomPanPinchRef>(null)
  const score = useMemo(() => board.getScore(), [board])

  // Returns whether a mine should be generated based on position
  function generateMine(position: Position): boolean {
    const { row, col } = position

    // Calculate the distance from the origin
    const distance = Math.sqrt(row ** 2 + col ** 2)

    // Avoid placing mines too close to the origin
    if (distance <= Math.sqrt(2)) return false

    // Calculate probability based on distance
    let probability =
      PROBABILITY_MINE_MIN +
      (Math.min(distance, DISTANCE_MINE_CAP) / DISTANCE_MINE_CAP) * (PROBABILITY_MINE_MAX - PROBABILITY_MINE_MIN)
    return Math.random() < probability
  }

  function expandBoard(prevBoard: Board, row: number, col: number): Board {
    const newBoard = prevBoard.clone()
    const queue: Position[] = []
    const offsets = [-1, 0, 1]

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
    newBoard.invalidateCache()
    return newBoard
  }

  function revealAdjacentTiles(prevBoard: Board, row: number, col: number): Board {
    let newBoard = prevBoard.clone()
    const queue: [number, number][] = [[row, col]]

    // BFS to reveal all connected empty tiles
    let current: [number, number] | undefined
    while ((current = queue.shift()) !== undefined) {
      const [currentRow, currentCol] = current
      const offsets = [-1, 0, 1]

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

  function revealTile(prevBoard: Board, row: number, col: number): Board {
    const position = new Position(row, col)
    let newBoard = expandBoard(prevBoard, row, col)
    const tile = newBoard.getTile(position)

    // If the tile is already revealed or is flagged, then do nothing
    if (!tile || tile.isRevealed || tile.isFlagged) {
      return prevBoard
    }

    // Reveal the clicked tile
    tile.isRevealed = true
    newBoard.addTile(position, tile)
    newBoard.invalidateCache()

    if (tile.isMine()) {
      // TODO: Handle the "game over" scenario
    } else if (tile.isEmpty()) {
      // If the clicked tile is empty, reveal adjacent tiles
      newBoard = revealAdjacentTiles(newBoard, row, col)
    }

    return newBoard
  }

  const toggleFlag = (row: number, col: number) => {
    const position = new Position(row, col)

    setBoard((prevBoard) => {
      const newBoard = prevBoard.clone()
      const tile = newBoard.getTile(position)
      // If the tile is revealed, then do nothing
      if (!tile || tile.isRevealed) {
        return prevBoard
      }

      tile.isFlagged = !tile.isFlagged
      newBoard.addTile(position, tile)
      newBoard.invalidateCache()

      return newBoard
    })
  }

  const handleChord = (row: number, col: number) => {
    const position = new Position(row, col)

    setBoard((prevBoard) => {
      let newBoard = prevBoard.clone()
      const tile = newBoard.getTile(position)
      const offsets = [-1, 0, 1]

      // If the tile doesn't exist or is not revealed, then do nothing
      if (!tile || !tile.isRevealed) {
        return prevBoard
      }

      // Count the number of adjacent flagged tiles and revealed mines
      let flaggedAdjacent = 0
      offsets.forEach((i) => {
        offsets.forEach((j) => {
          if (i !== 0 || j !== 0) {
            const newRow = row + i
            const newCol = col + j
            const newPosition = new Position(newRow, newCol)
            const newTile = newBoard.getTile(newPosition)
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
              const newTile = newBoard.getTile(newPosition)
              if (newTile && !newTile.isRevealed && !newTile.isFlagged) {
                newBoard = revealTile(newBoard, newRow, newCol)
              }
            }
          })
        })
      }
      return newBoard
    })
  }

  const handleTileMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, row: number, col: number) => {
      if (e.buttons === 2) {
        toggleFlag(row, col)
      }
      setMouseButtons(e.buttons)
    },
    [toggleFlag, setMouseButtons]
  )

  const handleTileMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, row: number, col: number) => {
      if (mouseButtons === 1 && e.buttons === 0) {
        setBoard((prevBoard) => {
          return revealTile(prevBoard, row, col)
        })
      } else if (mouseButtons === 3) {
        handleChord(row, col)
      }
      setMouseButtons(0)
    },
    [setBoard, revealTile, handleChord, setMouseButtons]
  )

  const resetPosition = () => {
    if (transformComponentRef.current) {
      const { resetTransform } = transformComponentRef.current
      resetTransform()
    }
  }

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

export default GameComponent
