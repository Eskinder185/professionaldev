export default function Contact(){
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Contact</h1>
      <form className="space-y-4">
        <input className="border p-2 w-full rounded" placeholder="Name" />
        <input className="border p-2 w-full rounded" placeholder="Email" />
        <textarea className="border p-2 w-full rounded" placeholder="Message" rows={5}></textarea>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
      </form>
      <div className="text-sm text-gray-600 mt-4">
        Social: LinkedIn • GitHub • Email
      </div>
    </div>
  )
}
