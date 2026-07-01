import {
  IconArrowsMove as Move,
  IconCrop as Crop,
  IconEdit as Edit,
  IconDeviceFloppy as Save,
  IconListDetails as ListDetails,
  IconPalette as Palette,
  IconPlus as Plus,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react'

export default function FloorToolbar({
  isActive,
  selectedRoom,
  isImageFloor,
  floorInteractionMode,
  drawTool,
  selectedCellsSize,
  hasImageSelection,
  savingLayout,
  currentPaintColor,
  MouseToolIcon,
  HandToolIcon,
  PaintToolIcon,
  imageRectangleTool,
  imagePolygonTool,
  onCreateFloor,
  onAddRoom,
  onEditFloor,
  onDeleteFloor,
  onSetDrawTool,
  onClearSelection,
  onDeleteActiveRegion,
  onFinishImagePolygon,
  onOpenRoomDraft,
  onExitInteractionMode,
  onPaintColorChange,
  onEditSelectedRoom,
  onEditSelectedLayout,
  onOpenSelectedAssets,
  onMoveSelected,
  onPaintSelected,
  onSelectedColorChange,
}) {
  if (!isActive) return null

  const canSubmitImageRoom = hasImageSelection || floorInteractionMode === 'edit'
  const canSubmitGridRoom = selectedCellsSize > 0
  const showDrawTools = floorInteractionMode === 'add' || floorInteractionMode === 'edit'
  const hasSelectedRoom = Boolean(selectedRoom)
  const roomActionDisabledTooltip = 'Vui lòng chọn phòng cần thao tác'

  const renderMenuAction = ({
    icon,
    label,
    onClick,
    active = false,
    disabled = false,
    danger = false,
    tooltip,
    trailing = null,
  }) => (
    <div key={label} className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
          danger
            ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
            : active
              ? 'border-fptOrange bg-orange-50 text-fptOrange shadow-sm'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
        } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-950 dark:disabled:text-slate-600`}
      >
        <span className="inline-flex items-center gap-2.5">
          <span className="inline-flex h-5 w-5 items-center justify-center">
            {icon}
          </span>
          <span>{label}</span>
        </span>
        {trailing}
      </button>
      {disabled && tooltip && (
        <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block group-focus-within:block">
          {tooltip}
        </div>
      )}
    </div>
  )

  const renderSection = (title, description, actions) => (
    <section className="space-y-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{title}</h4>
        {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <div className="space-y-2">
        {actions}
      </div>
    </section>
  )

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Công cụ</h3>
         
        </div>

        <div className="space-y-5">
          {renderSection(
            'Công cụ tầng',
            'Thêm, sửa hoặc xóa tầng đang làm việc.',
            <>
              {renderMenuAction({
                icon: <Plus size={18} />,
                label: 'Thêm tầng',
                onClick: onCreateFloor,
              })}
              {floorInteractionMode === 'view' && renderMenuAction({
                icon: <Edit size={18} />,
                label: 'Sửa tầng',
                onClick: onEditFloor,
              })}
              {floorInteractionMode === 'view' && renderMenuAction({
                icon: <Trash size={18} />,
                label: 'Xóa tầng',
                onClick: onDeleteFloor,
                danger: true,
              })}
            </>,
          )}

          {floorInteractionMode === 'view' && renderSection(
            'Công cụ phòng',
            hasSelectedRoom
              ? `Đang chọn: ${selectedRoom.name}`
              : 'Chọn một phòng trên sơ đồ để bật các thao tác chi tiết.',
            <>
              {renderMenuAction({
                icon: <Plus size={18} />,
                label: 'Thêm phòng',
                onClick: onAddRoom,
              })}
              {renderMenuAction({
                icon: <Edit size={18} />,
                label: 'Sửa thông tin',
                onClick: onEditSelectedRoom,
                disabled: !hasSelectedRoom,
                tooltip: roomActionDisabledTooltip,
              })}
              {renderMenuAction({
                icon: <Crop size={18} />,
                label: 'Chỉnh phạm vi',
                onClick: onEditSelectedLayout,
                disabled: !hasSelectedRoom,
                tooltip: roomActionDisabledTooltip,
              })}
              {renderMenuAction({
                icon: <ListDetails size={18} />,
                label: 'Xem tài sản',
                onClick: onOpenSelectedAssets,
                disabled: !hasSelectedRoom,
                tooltip: roomActionDisabledTooltip,
              })}
              {!isImageFloor && renderMenuAction({
                icon: <Move size={18} />,
                label: 'Di chuyển',
                onClick: onMoveSelected,
                active: drawTool === 'move',
                disabled: !hasSelectedRoom,
                tooltip: roomActionDisabledTooltip,
              })}
              <div className="group relative">
                <div className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  hasSelectedRoom
                    ? drawTool === 'paint'
                      ? 'border-fptOrange bg-orange-50 text-fptOrange shadow-sm'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                    : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-600'
                }`}>
                  <button
                    type="button"
                    onClick={onPaintSelected}
                    disabled={!hasSelectedRoom}
                    className="inline-flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-not-allowed"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <Palette size={18} />
                    </span>
                    <span>Đổi màu</span>
                  </button>
                  <label className={`relative inline-flex h-8 w-10 shrink-0 rounded-md border shadow-sm ${
                    hasSelectedRoom
                      ? 'cursor-pointer border-slate-300 dark:border-slate-700'
                      : 'cursor-not-allowed border-slate-200 dark:border-slate-800'
                  }`}
                  >
                    <span
                      className="absolute inset-0 rounded-md"
                      style={{ backgroundColor: currentPaintColor || selectedRoom?.colorHex || '#f97316' }}
                    />
                    <input
                      type="color"
                      value={currentPaintColor || selectedRoom?.colorHex || '#f97316'}
                      disabled={!hasSelectedRoom}
                      onChange={(event) => onSelectedColorChange(event.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    />
                  </label>
                </div>
                {!hasSelectedRoom && (
                  <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg group-hover:block">
                    {roomActionDisabledTooltip}
                  </div>
                )}
              </div>
              {renderMenuAction({
                icon: <X size={18} />,
                label: 'Bỏ chọn',
                onClick: onClearSelection,
                disabled: !hasSelectedRoom,
                tooltip: roomActionDisabledTooltip,
              })}
            </>,
          )}

          {showDrawTools && renderSection(
            floorInteractionMode === 'edit' ? 'Sửa phòng' : 'Tạo phòng',
            'Chọn công cụ vẽ rồi lưu vùng đã chọn.',
            <>
              {showDrawTools && isImageFloor && renderMenuAction({
                icon: <MouseToolIcon size={18} />,
                label: 'Vẽ rectangle',
                active: drawTool === imageRectangleTool,
                onClick: () => onSetDrawTool(imageRectangleTool),
              })}
              {showDrawTools && isImageFloor && renderMenuAction({
                icon: <Edit size={18} />,
                label: 'Vẽ polygon',
                active: drawTool === imagePolygonTool,
                onClick: () => onSetDrawTool(imagePolygonTool),
              })}
              {showDrawTools && !isImageFloor && renderMenuAction({
                icon: <MouseToolIcon size={18} />,
                label: 'Quét vùng',
                active: drawTool === 'select',
                onClick: () => onSetDrawTool('select'),
              })}
              {showDrawTools && !isImageFloor && renderMenuAction({
                icon: <HandToolIcon size={18} />,
                label: 'Di chuyển vùng',
                active: drawTool === 'move',
                onClick: () => onSetDrawTool('move'),
                disabled: floorInteractionMode === 'add' && selectedCellsSize === 0,
              })}
              {showDrawTools && !isImageFloor && renderMenuAction({
                icon: <PaintToolIcon size={18} />,
                label: 'Tô màu vùng',
                active: drawTool === 'paint',
                onClick: () => onSetDrawTool('paint'),
                disabled: floorInteractionMode === 'add' ? selectedCellsSize === 0 : false,
              })}
              {showDrawTools && !isImageFloor && (
                <label className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                  <span className="inline-flex items-center gap-2.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center">
                      <Palette size={18} />
                    </span>
                    <span>Màu vùng</span>
                  </span>
                  <input
                    type="color"
                    value={currentPaintColor}
                    onChange={(event) => onPaintColorChange(event.target.value)}
                    className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                </label>
              )}
              {showDrawTools && isImageFloor && drawTool === imagePolygonTool && renderMenuAction({
                icon: <Save size={18} />,
                label: 'Chốt polygon',
                onClick: onFinishImagePolygon,
                disabled: !hasImageSelection,
              })}
              {renderMenuAction({
                icon: <Save size={18} />,
                label: floorInteractionMode === 'edit' ? 'Lưu phòng' : 'Tạo phòng từ vùng chọn',
                onClick: onOpenRoomDraft,
                disabled: isImageFloor ? !canSubmitImageRoom || savingLayout : !canSubmitGridRoom || savingLayout,
              })}
              {floorInteractionMode === 'edit' && renderMenuAction({
                icon: <Trash size={18} />,
                label: 'Xóa vùng',
                onClick: onDeleteActiveRegion,
                danger: true,
              })}
              {renderMenuAction({
                icon: <X size={18} />,
                label: floorInteractionMode === 'edit' ? 'Hủy sửa' : 'Thoát chế độ vẽ',
                onClick: onExitInteractionMode,
              })}
            </>,
          )}
        </div>
      </div>
    </div>
  )
}
