'use client'

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from './dndModifiers'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Fragment, useState } from 'react'
import type { Pin, TravelMode } from '../../types'
import { ChevronRightIcon, GripIcon } from '../icons'
import { LegEditor } from './LegEditor'
import type { DraftLeg } from './useMapDraft'

interface Props {
  pins: Pin[]
  legs: DraftLeg[]
  selectedPinId: string | null
  onSelect: (pinId: string) => void
  onMove: (fromIndex: number, toIndex: number) => void
  onLegChange: (fromPinId: string, toPinId: string, patch: { mode?: TravelMode; durationMin?: number | null }) => void
}

/** 핀 목록. 왼쪽 손잡이를 끌어서 순서 변경, 핀 사이에는 이동구간 입력. */
export function PinList({ pins, legs, selectedPinId, onSelect, onMove, onLegChange }: Props) {
  const [dragging, setDragging] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(false)
    if (!over || active.id === over.id) return
    const from = pins.findIndex((p) => p.id === active.id)
    const to = pins.findIndex((p) => p.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }

  return (
    <DndContext
      id="pin-list"
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={pins.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ol className="py-2">
          {pins.map((pin, i) => (
            <Fragment key={pin.id}>
              <PinRow pin={pin} index={i} selected={pin.id === selectedPinId} onSelect={() => onSelect(pin.id)} />
              {/* 끄는 동안에는 구간 입력을 숨겨서 순서 바꾸기 쉽게 */}
              {!dragging && legs[i] && (
                <li className="relative list-none">
                  <LegEditor leg={legs[i]} from={pin.place} to={pins[i + 1]?.place} onChange={(patch) => onLegChange(legs[i].fromPinId, legs[i].toPinId, patch)} />
                </li>
              )}
            </Fragment>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function PinRow({ pin, index, selected, onSelect }: { pin: Pin; index: number; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: pin.id })
  const sub = [pin.visitedAt?.replaceAll('-', '.'), pin.memo].filter(Boolean).join(' · ')

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative list-none ${isDragging ? 'z-10' : ''}`}
    >
      <div
        className={`mx-2 flex items-center gap-1 rounded-xl pr-2 transition ${
          isDragging ? 'tm-float bg-(--c-surface)' : selected ? 'bg-(--c-accent)/10' : 'hover:bg-black/[0.03]'
        }`}
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          className="grid h-14 w-7 shrink-0 cursor-grab touch-none place-items-center text-(--c-muted)/60 hover:text-(--c-muted) active:cursor-grabbing"
          aria-label={`${pin.place.name} 순서 바꾸기`}
        >
          <GripIcon size={16} />
        </button>
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
          <span
            className="relative grid size-10 shrink-0 place-items-center rounded-full text-lg shadow-sm ring-2 ring-(--c-surface)"
            style={{ background: pin.color }}
          >
            {pin.icon}
            <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gray-900 px-1 text-[0.625rem] font-bold text-white ring-2 ring-(--c-surface)">
              {index + 1}
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold">{pin.place.name}</span>
            <span className="block truncate text-[0.8125rem] text-(--c-muted)">{sub || '눌러서 꾸미기'}</span>
          </span>
          {pin.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data URL/외부 URL 미리보기
            <img src={pin.photoUrl} alt="" className="size-10 shrink-0 rounded-lg object-cover" />
          )}
          <ChevronRightIcon size={16} className="shrink-0 text-(--c-muted)/60" />
        </button>
      </div>
    </li>
  )
}
