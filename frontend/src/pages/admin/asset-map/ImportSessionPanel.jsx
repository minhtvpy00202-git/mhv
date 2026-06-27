import { IconUpload as Upload } from '@tabler/icons-react'
import { resolveBackendMediaUrl } from '../../../utils/mediaUrl'

export default function ImportSessionPanel({
  importSubmitting,
  importApplying,
  imageImportSession,
  selectedImportDrawingIds,
  onClose,
  onFileChange,
  onToggleDrawing,
  onApply,
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import ảnh bản vẽ</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Chọn ảnh PNG, JPG hoặc JPEG của mặt bằng để dùng làm ảnh nền sơ đồ. Sau khi tạo tầng IMAGE, bạn sẽ tự khoanh các phòng trực tiếp trên ảnh.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importApplying}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-950">
            <Upload size={22} className="text-fptOrange" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {importSubmitting ? 'Đang chuẩn bị ảnh nền...' : 'Bấm để chọn ảnh PNG/JPG/JPEG'}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Ảnh sẽ được dùng làm nền sơ đồ, sau đó bạn tự khoanh các phòng trực tiếp trên ảnh.</span>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
              onChange={onFileChange}
              disabled={importSubmitting || importApplying}
              className="hidden"
            />
          </label>
        </div>

        {imageImportSession?.sourceFileName && (
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{imageImportSession.sourceFileType || 'IMAGE'}</span>
            <span className="font-medium text-slate-700 dark:text-slate-200">{imageImportSession.sourceFileName}</span>
          </div>
        )}

        {!importSubmitting && imageImportSession.drawings?.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ảnh nền đã tải lên</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Chọn ảnh muốn dùng để tạo tầng IMAGE, rồi tự vẽ phòng sau.</p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Đã chọn {selectedImportDrawingIds.length}/{imageImportSession.drawings.length}
              </span>
            </div>

            <div className="grid max-h-[55vh] gap-4 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {imageImportSession.drawings.map((drawing) => {
                const checked = selectedImportDrawingIds.includes(drawing.drawingId)
                return (
                  <label
                    key={drawing.drawingId}
                    className={`overflow-hidden rounded-2xl border transition ${
                      checked
                        ? 'border-fptOrange ring-2 ring-orange-100'
                        : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{drawing.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Ảnh nền • {Math.round(drawing.width || 0)} x {Math.round(drawing.height || 0)}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleDrawing(drawing.drawingId)}
                        className="h-4 w-4 rounded border-slate-300 text-fptOrange focus:ring-fptOrange"
                      />
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/40">
                      {drawing.previewUrl ? (
                        <img
                          src={resolveBackendMediaUrl(drawing.previewUrl)}
                          alt={drawing.title}
                          className="h-52 w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-52 items-center justify-center px-4 text-center text-sm text-slate-400 dark:text-slate-500">
                          Chưa có preview
                        </div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {!importSubmitting && imageImportSession?.sourceFileName && imageImportSession.drawings?.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Không thể đọc ảnh này để làm nền sơ đồ. Hãy thử lại bằng ảnh PNG/JPG/JPEG hợp lệ.
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={importApplying}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onApply}
            disabled={importSubmitting || importApplying || !selectedImportDrawingIds.length}
            className="rounded-lg bg-fptOrange px-4 py-2 text-sm font-semibold text-white hover:bg-fptOrangeDark disabled:opacity-60"
          >
            {importApplying ? 'Đang tạo sơ đồ...' : 'Tạo sơ đồ'}
          </button>
        </div>
      </div>
    </div>
  )
}
