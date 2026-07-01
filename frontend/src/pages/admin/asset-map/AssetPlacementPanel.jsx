import {
  IconArrowsMove as Move,
  IconCamera as Camera,
  IconEdit as Edit,
  IconListDetails as ListDetails,
  IconPalette as Palette,
  IconSearch as Search,
  IconTrash as Trash,
  IconX as X,
} from '@tabler/icons-react'
import ModalOverlay from '../../../components/ui/ModalOverlay'
import SearchableSelect from '../../../components/ui/SearchableSelect'

export default function AssetPlacementPanel({
  categories,
  floors,
  activeFloor,
  roomItems,
  selectedRoom,
  selectedRoomCount,
  isImageFloor,
  floorInteractionMode,
  drawTool,
  currentPaintColor,
  filteredLocationOptions,
  searchFilters,
  searchResults,
  searching,
  showSearchModal,
  onSearchFilterChange,
  onOpenSearchModal,
  onCloseSearchModal,
  onOpenScanner,
  onSearch,
  onResetSearch,
  onJumpToAssetFloor,
  onSelectRoom,
  onEditSelectedRoom,
  onEditSelectedLayout,
  onOpenSelectedAssets,
  onMoveSelected,
  onPaintSelected,
  onDeleteSelected,
  onClearSelection,
  onSelectedColorChange,
}) {
  return (
    <aside className="space-y-4">
      <div className="sticky top-4 space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Khu vực đang chọn</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {selectedRoom
                  ? 'Thao tác nhanh với khu vực đang được chọn trên canvas.'
                  : selectedRoomCount > 1
                    ? `Đang chọn ${selectedRoomCount} khu vực.`
                    : 'Chọn một khu vực trên canvas để xem thông tin và thao tác.'}
              </p>
            </div>
            {selectedRoom && (
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedRoom.syncMeta.tone}`}>
                {selectedRoom.syncMeta.label}
              </span>
            )}
          </div>

          {!selectedRoom && selectedRoomCount <= 1 && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Chưa có khu vực nào được chọn.
            </div>
          )}

          {selectedRoomCount > 1 && !selectedRoom && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200">
              Bạn đang chọn nhiều khu vực. Hãy dùng canvas hoặc bỏ bớt lựa chọn để chỉnh sửa chi tiết từng khu vực.
            </div>
          )}

          {selectedRoom && (
            <>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedRoom.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedRoom.assetCount} tài sản đang gắn</p>
                  </div>
                  <span
                    className="mt-1 h-5 w-5 rounded-full border border-white shadow"
                    style={{ backgroundColor: selectedRoom.colorHex }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                    <p className="text-slate-500 dark:text-slate-400">Loại khu vực</p>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{selectedRoom.areaType.label}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 dark:bg-slate-900">
                    <p className="text-slate-500 dark:text-slate-400">Trạng thái</p>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-100">{selectedRoom.syncMeta.label}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onEditSelectedRoom}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Edit size={16} />
                  Sửa thông tin
                </button>
                <button
                  type="button"
                  onClick={onEditSelectedLayout}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Edit size={16} />
                  Chỉnh phạm vi
                </button>
                <button
                  type="button"
                  onClick={onOpenSelectedAssets}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ListDetails size={16} />
                  Xem tài sản
                </button>
                {!isImageFloor && (
                  <button
                    type="button"
                    onClick={onMoveSelected}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      drawTool === 'move'
                        ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Move size={16} />
                    Di chuyển
                  </button>
                )}
                <button
                  type="button"
                  onClick={onPaintSelected}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    drawTool === 'paint'
                      ? 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Palette size={16} />
                  Tô màu
                </button>
                <button
                  type="button"
                  onClick={onDeleteSelected}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                >
                  <Trash size={16} />
                  Xóa vùng
                </button>
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                  Bỏ chọn
                </button>
              </div>

              {floorInteractionMode === 'view' && (
                <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
                  <span>Màu khu vực</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{String(currentPaintColor || selectedRoom.colorHex).toUpperCase()}</span>
                    <input
                      type="color"
                      value={currentPaintColor || selectedRoom.colorHex}
                      onChange={(event) => onSelectedColorChange(event.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                  </div>
                </label>
              )}
            </>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Khu vực trên tầng</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeFloor ? `${roomItems.length} khu vực trên ${activeFloor.name}.` : 'Chọn tầng để xem danh sách khu vực.'}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {!activeFloor && (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Chưa có tầng hoạt động.
              </div>
            )}
            {activeFloor && roomItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Chưa có khu vực nào trên tầng này.
              </div>
            )}
            {roomItems.map((room) => (
              <button
                key={`room-item-${room.id}`}
                type="button"
                onClick={(event) => onSelectRoom(room.shape, event)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                  room.selected
                    ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200'
                    : 'border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{room.label}</p>
                    <p className="mt-1 text-xs opacity-80">{room.areaTypeLabel} · {room.assetCount} tài sản</p>
                  </div>
                  <span
                    className="mt-1 h-4 w-4 rounded-full border border-white shadow"
                    style={{ backgroundColor: room.colorHex }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tài sản trên sơ đồ</h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">{searchResults.length} tài sản</span>
          </div>
          <div className="mt-4 space-y-3">
            <button
              type="button"
              onClick={onOpenSearchModal}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fptOrange px-4 py-3 text-sm font-semibold text-white transition hover:bg-fptOrangeDark"
            >
              <Search size={16} />
              Tìm tài sản
            </button>
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Bấm `Tìm tài sản` để mở bộ lọc, quét QR và xem danh sách kết quả.
            </div>
          </div>
        </div>
      </div>

      {showSearchModal && (
        <ModalOverlay zIndex={120}>
          <div className="w-full max-w-3xl rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tìm tài sản</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Quét QR, nhập QA code, tên tài sản hoặc lọc theo loại và phòng.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Camera size={16} />
                  Quét QR
                </button>
                <button
                  type="button"
                  onClick={onCloseSearchModal}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Từ khóa</label>
                    <input
                      value={searchFilters.keyword}
                      onChange={(event) => onSearchFilterChange({ keyword: event.target.value })}
                      placeholder="Nhập QA code hoặc tên tài sản"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Loại tài sản</label>
                    <SearchableSelect
                      value={searchFilters.categoryId}
                      onChange={(nextValue) => onSearchFilterChange({ categoryId: String(nextValue || '') })}
                      options={categories}
                      getOptionValue={(category) => category.id}
                      getOptionLabel={(category) => category.name}
                      placeholder="Gõ để tìm loại tài sản"
                      emptyOptionLabel="Tất cả loại"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tầng</label>
                    <SearchableSelect
                      value={searchFilters.floorId}
                      onChange={(nextValue) => onSearchFilterChange({ floorId: String(nextValue || ''), locationId: '' })}
                      options={floors}
                      getOptionValue={(floor) => floor.id}
                      getOptionLabel={(floor) => floor.name}
                      placeholder="Gõ để tìm tầng"
                      emptyOptionLabel="Tất cả tầng"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phòng</label>
                    <SearchableSelect
                      value={searchFilters.locationId}
                      onChange={(nextValue) => onSearchFilterChange({ locationId: String(nextValue || '') })}
                      options={filteredLocationOptions}
                      getOptionValue={(location) => location.id}
                      getOptionLabel={(location) => location.roomName}
                      placeholder="Gõ để tìm phòng"
                      emptyOptionLabel="Tất cả phòng"
                    />
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={onSearch}
                    disabled={searching}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-fptOrange px-3 py-2.5 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
                  >
                    <Search size={16} />
                    Tìm kiếm
                  </button>
                  <button
                    type="button"
                    onClick={onResetSearch}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Xóa
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kết quả</h4>
                  <span className="text-sm text-slate-500 dark:text-slate-400">{searchResults.length} tài sản</span>
                </div>
                <div className="mt-4 max-h-[480px] space-y-3 overflow-auto pr-1">
                  {searchResults.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Chưa có kết quả. Hãy dùng bộ lọc hoặc quét QR để hiển thị marker trên sơ đồ.
                    </div>
                  )}
                  {searchResults.map((asset) => {
                    const floor = floors.find((item) => Number(item.id) === Number(asset.floorId))
                    const isMapped = floor?.roomShapes?.some((shape) => Number(shape.locationId) === Number(asset.locationId))
                    return (
                      <button
                        key={asset.qaCode}
                        type="button"
                        onClick={() => {
                          onJumpToAssetFloor(asset.floorId)
                          onCloseSearchModal()
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{asset.name}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">QA: {asset.qaCode}</p>
                          </div>
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
                            Marker
                          </span>
                        </div>
                        <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                          <p>Phòng hiện tại: {asset.locationName || 'Chưa rõ'}</p>
                          <p>Tầng: {asset.floorName || 'Chưa gán tầng'}</p>
                          <p>Loại: {asset.categoryName || 'Chưa rõ'}</p>
                          {!isMapped && <p className="font-semibold text-amber-600">Phòng này chưa được vẽ trên sơ đồ.</p>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </aside>
  )
}
