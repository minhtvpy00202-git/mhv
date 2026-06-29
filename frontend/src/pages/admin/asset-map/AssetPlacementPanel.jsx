import { IconCamera as Camera, IconSearch as Search } from '@tabler/icons-react'
import SearchableSelect from '../../../components/ui/SearchableSelect'

export default function AssetPlacementPanel({
  categories,
  floors,
  filteredLocationOptions,
  searchFilters,
  searchResults,
  searching,
  onSearchFilterChange,
  onOpenScanner,
  onSearch,
  onResetSearch,
  onJumpToAssetFloor,
}) {
  return (
    <aside className="space-y-4">
      <div className="sticky top-4 space-y-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tìm tài sản</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Quét QR, nhập QA code, tên tài sản hoặc lọc theo loại và phòng.</p>
            </div>
            <button
              type="button"
              onClick={onOpenScanner}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Camera size={16} />
              Quét QR
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Từ khóa</label>
              <input
                value={searchFilters.keyword}
                onChange={(event) => onSearchFilterChange({ keyword: event.target.value })}
                placeholder="Nhập QA code hoặc tên tài sản"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-fptOrange focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-fptOrange px-3 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
            >
              <Search size={16} />
              Tìm kiếm
            </button>
            <button
              type="button"
              onClick={onResetSearch}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Xóa
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kết quả</h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">{searchResults.length} tài sản</span>
          </div>
          <div className="mt-4 space-y-3">
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
                  onClick={() => onJumpToAssetFloor(asset.floorId)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-orange-500/40 dark:hover:bg-orange-500/10"
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
    </aside>
  )
}
