function Home() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Xin chào nhân viên</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sử dụng tab Quét QR để mượn/trả thiết bị nhanh và tab Báo hỏng để gửi yêu cầu sửa chữa.
        </p>
      </section>
      <section className="rounded-2xl bg-orange-50 p-4">
        <p className="text-sm font-medium text-fptOrangeDark">
          Màu nhận diện FPT đang được áp dụng cho toàn bộ trạng thái chính.
        </p>
      </section>
    </div>
  )
}

export default Home
