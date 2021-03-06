import React from 'react'
import {
  StyleSheet,
  View,
  ViewStyle,
  LayoutChangeEvent,
  LayoutRectangle,
  PanResponder,
  PanResponderInstance,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native'

import PieceEl from './Piece'
import SquareLight from './SquareLight'
import Background from './Background'
import * as util from './util'
import { BoardPiece, BoardPieces, Key, Light } from './types'
import { BoardConfig } from './config'
import * as stateApi from './state'

export interface BoardHandlers {
  onSelectSquare: (k: Key | null) => void
  onMove: (orig: Key, dest: Key, animate?: boolean) => void
}

interface Props {
  size: number
  state: stateApi.BoardState
  handlers: BoardHandlers
  config: BoardConfig
}

const hiddenShadowPos = { x: 999999, y: 999999 }
// const MOVE_THRESHOLD = 2

export default class Board extends React.PureComponent<Props, void> {
  private layout: LayoutRectangle
  private panResponder: PanResponderInstance

  // board key that is currently overflown by a piece during drag
  // null if out of bounds or no piece currently dragged
  private dragOver: Key | null

  // re-select square means de-select so we keep track of the previously
  // selected square
  private previouslySelected: Key | null

  // ref to the dragging piece
  private draggingPiece: PieceEl | null
  // ref to the shadow view element
  private shadow?: View

  constructor(props: Props) {
    super(props)

    this.dragOver = null
    this.draggingPiece = null
    this.previouslySelected = null

    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: this.handlePanResponderGrant,
      onPanResponderMove: this.handlePanResponderMove,
      onPanResponderRelease: this.handlePanResponderRelease,
      onPanResponderTerminate: this.handlePanResponderTerminate
    })
  }

  render() {
    const { size } = this.props
    const { pieces } = this.props.state
    const sqSize = size / 8
    const shadowStyle = {
      width: sqSize * 2,
      height: sqSize * 2,
      transform: this.getCurrentShadowTransform()
    }
    return (
      <View
        style={[styles.container, { width: size, height: size }]}
        onLayout={this.onLayout}
        {...this.panResponder.panHandlers}
      >
        <Background size={size} darkColor="#B58863" lightColor="#F0D9B5" />
        <View
          ref={(e: any) => { this.shadow = e }}
          style={[styles.shadow, shadowStyle]}
        />
        {this.renderLights(sqSize)}
        {this.renderPieces(pieces, sqSize)}
      </View>
    )
  }

  renderLights(sqSize: number) {
    const { config, state } = this.props
    const lights = stateApi.computeSquareLights(state, config)
    const els: JSX.Element[] = []
    lights.forEach((l: Light, k: Key) => {
      els.push(<SquareLight key={'light'+k} light={l} size={sqSize} boardKey={k} />)
    })

    return els
  }

  renderPieces(pieces: BoardPieces, sqSize: number) {
    const anims = this.props.state.animatePieces
    const dg = this.draggingPiece
    const ks = Object.keys(pieces)
    const staticPieces: JSX.Element[] = []
    const animatedPieces: JSX.Element[] = []
    const interactedPiece: JSX.Element[] = []
    for (let i = 0; i < ks.length; i++) {
      const k = ks[i] as Key
      const p = pieces[k]
      if (p !== undefined) {
        const el = this.renderPiece(k, p, sqSize)
        if (anims !== undefined && anims.has(k)) animatedPieces.push(el)
        else if (dg !== null && dg.props.boardKey === k) interactedPiece.push(el)
        else staticPieces.push(el)
      }
    }
    // ensure moving pieces are rendered after static ones to emulate zIndex
    return staticPieces.concat(animatedPieces).concat(interactedPiece)
  }

  renderPiece(key: Key, piece: BoardPiece, size: number) {
    const anims = this.props.state.animatePieces
    return (
      <PieceEl
        key={piece.id}
        boardKey={key}
        size={size}
        theme="cburnett"
        role={piece.role}
        color={piece.color}
        animate={anims !== undefined ? anims.has(key) : undefined}
        ref={key}
      />
    )
  }

  private onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    this.layout = nativeEvent.layout
  }

  private handlePanResponderGrant = (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
    const { state, config } = this.props
    const key = util.getKeyFromGrantEvent(gesture, this.layout)
    const sel = state.selected
    if (key !== null) {
      // there's a piece under that can move: select square and start drag
      if (state.pieces[key] !== undefined && stateApi.isMovable(state, config, key)) {
        const p = this.refs[key]
        this.previouslySelected = sel
        this.props.handlers.onSelectSquare(key)
        // when this.draggingPiece is not null means dragging has started
        // we force update to put it at the end of the rendered stack
        if (p && stateApi.isDraggable(state, config, key)) {
          this.draggingPiece = p as PieceEl
          this.forceUpdate()
        }
      }
      // no piece under that can move
      // if a square is already selected: unselect square or move
      else if (sel !== null) {
        const selPiece = state.pieces[sel]
        if (selPiece !== undefined && stateApi.canMoveTo(state, config, sel, key)) {
          this.props.handlers.onMove(sel, key)
        } else {
          this.props.handlers.onSelectSquare(null)
        }
      }
    }
  }

  private handlePanResponderMove = (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    const sqSize = this.props.size / 8
    if (this.draggingPiece) {
      this.draggingPiece.setNativeProps({
        style: {
          transform: [{ translate: [
            gestureState.moveX - this.layout.x - (sqSize / 2),
            gestureState.moveY - this.layout.y - sqSize
          ]}, {scale: 2}]
        }
      })

      const prevKey = this.dragOver
      this.dragOver = util.getKeyFromMoveEvent(gestureState, this.layout)
      if (this.shadow && prevKey !== this.dragOver) {
        this.shadow.setNativeProps({
          style: {
            transform: this.getCurrentShadowTransform()
          }
        })
      }
    }
  }

  private handlePanResponderRelease = (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
    const { state, config } = this.props
    const orig = state.selected
    const dest = this.dragOver
    this.dragOver = null
    this.removeShadow()
    if (this.draggingPiece && orig) {
      // TODO threshold
      const hasMoved = gestureState.dx !== 0 || gestureState.dy !== 0
      if (dest === null) {
        this.cancelDrag()
      } else if (stateApi.canMoveTo(state, config, orig, dest)) {
        const pos = util.key2Pos(dest, this.props.size / 8)
        this.draggingPiece.setNativeProps({
          style: {
            transform: [{ translate: [ pos.x, pos.y ]}]
          }
        })
        this.props.handlers.onMove(orig, dest, false)
      } else {
        this.cancelDrag()
      }
      if (this.previouslySelected === orig && !hasMoved) {
        this.props.handlers.onSelectSquare(null)
      }
    } else {
      this.cancelDrag()
    }
  }

  private handlePanResponderTerminate = () => {
    this.removeShadow()
    this.cancelDrag()
  }

  private removeShadow() {
    if (this.shadow) {
      this.shadow.setNativeProps({
        style: {
          transform: [{ translate: [hiddenShadowPos.x, hiddenShadowPos.y] }]
        }
      })
    }
  }

  private cancelDrag() {
    if (this.draggingPiece) {
      const pos = util.key2Pos(this.draggingPiece.props.boardKey, this.props.size / 8)
      this.draggingPiece.setNativeProps({
        style: {
          transform: [{ translate: [ pos.x, pos.y ]}]
        }
      })
      this.draggingPiece = null
    }
  }

  private getCurrentShadowTransform() {
    const sqSize = this.props.size / 8
    const pos = this.dragOver !== null ? util.key2Pos(this.dragOver, sqSize) : hiddenShadowPos
    return [{ translate: [pos.x - sqSize / 2, pos.y - sqSize / 2] }]
  }
}

interface Style {
  container: ViewStyle
  innerContainer: ViewStyle
  shadow: ViewStyle
}

const styles = StyleSheet.create<Style>({
  container: {
    width: 200,
    height: 200,
  },
  innerContainer: {
    position: 'absolute',
  },
  shadow: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 50
  }
})
