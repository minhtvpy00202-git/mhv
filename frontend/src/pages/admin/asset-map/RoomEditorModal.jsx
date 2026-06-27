import { IconInfoCircle as InfoCircle } from '@tabler/icons-react'
import { CUSTOM_AREA_TYPE_KEY, isCustomAreaTypeKey, resolveAreaTypeDraft } from './areaTypes'

export default function RoomEditorModal({
  selectedShape,
  floorInteractionMode,
  roomDraft,
  locations,
  locationOptionsForRoomModal,
  areaTypeOptions,
  areaTypePresets,
  roomShapeByLocationId,
  onClose,
  onRoomDraftChange,
  onSave,
}) {
  const presetByKey = new Map((areaTypePresets || []).map((preset) => [preset.typeKey || preset.key, preset]))
  const customTypeOptions = (areaTypeOptions || []).filter(
    (option) => option.key !== CUSTOM_AREA_TYPE_KEY && !presetByKey.has(option.key),
  )
  const assetCapableOptions = (areaTypeOptions || []).filter((option) => presetByKey.get(option.key)?.defaultHasAsset)
  const nonAssetOptions = (areaTypeOptions || []).filter((option) => (
    option.key !== CUSTOM_AREA_TYPE_KEY && presetByKey.has(option.key) && !presetByKey.get(option.key)?.defaultHasAsset
  ))
  const isCustomType = isCustomAreaTypeKey(roomDraft.areaTypeKey)
  const areaTypeSelectValue = (areaTypeOptions || []).some((option) => option.key === roomDraft.areaTypeKey)
    ? roomDraft.areaTypeKey
    : (isCustomType ? CUSTOM_AREA_TYPE_KEY : (roomDraft.areaTypeKey || ''))
  const isCreatingCustomType = areaTypeSelectValue === CUSTOM_AREA_TYPE_KEY || roomDraft.areaTypeKey === CUSTOM_AREA_TYPE_KEY
  const selectedPreset = presetByKey.get(roomDraft.areaTypeKey)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {!selectedShape
              ? 'Tạo phòng từ vùng chọn'
              : floorInteractionMode === 'edit'
                ? 'Cập nhật phòng sau khi vẽ lại'
                : 'Sửa thông tin phòng'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Kiểu gán phòng</label>
            <select
              value={roomDraft.mode}
              onChange={(event) => {
                const nextMode = event.target.value
                onRoomDraftChange(
                  nextMode === 'new'
                    ? { mode: 'new', locationId: '' }
                    : { mode: 'existing' },
                )
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="new">Tạo phòng mới</option>
              <option value="existing">Gắn phòng có sẵn</option>
            </select>
          </div>

          {roomDraft.mode === 'existing' ? (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Phòng có sẵn</label>
              <select
                value={roomDraft.locationId}
                onChange={(event) => {
                  const nextLocationId = event.target.value
                  const selectedLocation = locations.find((item) => String(item.id) === String(nextLocationId))
                  const linkedShape = roomShapeByLocationId?.get?.(Number(nextLocationId))
                  const areaTypeDraft = linkedShape ? resolveAreaTypeDraft(linkedShape, areaTypePresets) : {
                    areaTypeKey: roomDraft.areaTypeKey || 'ROOM',
                    areaTypeLabel: roomDraft.areaTypeLabel || 'Phòng',
                  }
                  onRoomDraftChange({
                    locationId: nextLocationId,
                    areaTypeKey: areaTypeDraft.areaTypeKey,
                    areaTypeLabel: areaTypeDraft.areaTypeLabel,
                    hasAsset: selectedLocation?.hasAsset !== false,
                  })
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="">
                  {locationOptionsForRoomModal.length === 0
                    ? 'Không còn phòng trống để gắn'
                    : 'Chọn phòng'}
                </option>
                {locationOptionsForRoomModal.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.roomName}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Chỉ hiển thị các phòng trên tầng này chưa được vẽ sơ đồ để tránh gán trùng.
              </p>
            </div>
          ) : (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên phòng mới</label>
              <input
                value={roomDraft.roomName}
                onChange={(event) => onRoomDraftChange({ roomName: event.target.value })}
                placeholder="Ví dụ: P.201 hoặc Kho thiết bị"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Loại khu vực</label>
            <select
              value={areaTypeSelectValue}
              onChange={(event) => {
                const nextAreaTypeKey = event.target.value
                if (nextAreaTypeKey === CUSTOM_AREA_TYPE_KEY) {
                  onRoomDraftChange({
                    areaTypeKey: CUSTOM_AREA_TYPE_KEY,
                    areaTypeLabel: isCustomType ? roomDraft.areaTypeLabel : '',
                  })
                  return
                }

                const selectedOption = areaTypeOptions.find((option) => option.key === nextAreaTypeKey)
                const selectedCatalogType = presetByKey.get(nextAreaTypeKey)
                onRoomDraftChange({
                  areaTypeKey: nextAreaTypeKey,
                  areaTypeLabel: selectedOption?.label || '',
                  hasAsset: selectedCatalogType?.defaultHasAsset !== false,
                })
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Chọn loại khu vực</option>
              {assetCapableOptions.length > 0 && (
                <optgroup label="Khu vực có thể chứa tài sản">
                  {assetCapableOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {nonAssetOptions.length > 0 && (
                <optgroup label="Khu vực không chứa tài sản">
                  {nonAssetOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {customTypeOptions.length > 0 && (
                <optgroup label="Loại đã tạo">
                  {customTypeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={CUSTOM_AREA_TYPE_KEY}>Thêm loại khác...</option>
            </select>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {selectedPreset
                ? `${selectedPreset.label} được mặc định là khu vực ${selectedPreset.defaultHasAsset ? 'có thể' : 'không'} chứa tài sản.`
                : 'Chọn loại khu vực rõ nghĩa như Phòng, Hành lang, Cầu thang hoặc tự thêm loại mới.'}
            </p>
          </div>

          {isCreatingCustomType && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Tên loại khu vực mới</label>
              <input
                value={roomDraft.areaTypeLabel}
                onChange={(event) => onRoomDraftChange({ areaTypeKey: CUSTOM_AREA_TYPE_KEY, areaTypeLabel: event.target.value })}
                placeholder="Ví dụ: Đường, Sảnh ngoài trời, Khu chờ"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Màu phòng</label>
            <input
              type="color"
              value={roomDraft.colorHex}
              onChange={(event) => onRoomDraftChange({ colorHex: event.target.value })}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>
          {isCreatingCustomType ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-start gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={roomDraft.hasAsset !== false}
                    onChange={(event) => onRoomDraftChange({ hasAsset: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                  />
                  Khu vực chứa tài sản
                </label>
                <div className="group relative mt-0.5">
                  <button
                    type="button"
                    className="text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label="Giải thích khu vực chứa tài sản"
                  >
                    <InfoCircle size={16} />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl group-hover:block group-focus-within:block">
                    Khi thêm loại khu vực mới, bạn có thể chọn khu vực này có được phép làm vị trí đặt hoặc lưu trữ tài sản hay không.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              {selectedPreset
                ? `${selectedPreset.label} được hệ thống xác định là khu vực ${selectedPreset.defaultHasAsset ? 'có thể' : 'không'} chứa tài sản.`
                : 'Loại khu vực đã chọn sẽ tự áp dụng quy tắc chứa tài sản theo danh mục quản lý.'}
            </div>
          )}
        </div>

        <div className="mt-4 flex w-full justify-end gap-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark"
          >
            Lưu phòng trên sơ đồ
          </button>
        </div>
      </div>
    </div>
  )
}
