export default function Contact() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Contact</h1>
      <form className="space-y-4">
        <input className="border p-2 w-full" placeholder="Name" />
        <input className="border p-2 w-full" placeholder="Email" />
        <textarea className="border p-2 w-full" placeholder="Message"></textarea>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
      </form>
    </div>
  )
}