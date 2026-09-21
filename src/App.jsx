import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

const ACCOUNTS = {
  admin: { pass: 'adminberrybaku', role: 'admin' },
  user: { pass: 'user', role: 'user' },
}

/* ---------------- Giriş ---------------- */
function Login({ onLogin }) {
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')

  const submit = () => {
    const acc = ACCOUNTS[u.trim()]
    if (acc && acc.pass === p) {
      sessionStorage.setItem('role', acc.role)
      onLogin(acc.role)
    } else setErr('Ad və ya parol səhvdir')
  }

  return (
    <div className="login">
      <div className="card">
        <h1>Tur Qalereyası</h1>
        <input placeholder="İstifadəçi adı" value={u} onChange={(e) => setU(e.target.value)} />
        <input
          type="password"
          placeholder="Parol"
          value={p}
          onChange={(e) => setP(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {err && <p className="err">{err}</p>}
        <button className="primary" onClick={submit}>Daxil ol</button>
      </div>
    </div>
  )
}

/* ---------------- Media göstərici ---------------- */
function Media({ item, onOpen }) {
  return item.type === 'video' ? (
    <video src={item.url} controls preload="metadata" playsInline />
  ) : (
    <img src={item.url} alt={item.name || ''} loading="lazy" onClick={() => onOpen(item)} />
  )
}

function Lightbox({ item, onClose }) {
  if (!item) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={item.url} alt="" />
    </div>
  )
}



/* ---------------- User görünüşü ---------------- */
function UserView({ sections, items }) {
  const [open, setOpen] = useState(null)
  const shown = items.filter((i) => i.visible)
  const groups = sections
    .map((s) => ({ ...s, list: shown.filter((i) => i.section_id === s.id) }))
    .filter((g) => g.list.length)

  if (!groups.length) return <p className="empty">Hələlik göstəriləcək heç nə yoxdur.</p>

  return (
    <div className="content">
      {groups.map((g) => (
        <section key={g.id}>
          <h2>{g.name}</h2>
          <div className="stack">
            {g.list.map((i) => (
              <div className="media-card" key={i.id}>
                <Media item={i} onOpen={setOpen} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <Lightbox item={open} onClose={() => setOpen(null)} />
    </div>
  )
}

/* ---------------- Admin görünüşü ---------------- */
function AdminView({ sections, items, reload }) {
  const [current, setCurrent] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    if (!current && sections.length) setCurrent(sections[0].id)
    if (current && !sections.find((s) => s.id === current)) setCurrent(sections[0]?.id ?? null)
  }, [sections, current])

  const list = items.filter((i) => i.section_id === current)

  const addSection = async () => {
    const name = prompt('Yeni qovluğun adı:')
    if (!name?.trim()) return
    const { data, error } = await supabase.from('sections').insert({ name: name.trim() }).select().single()
    if (error) return alert(error.message)
    await reload()
    setCurrent(data.id)
  }

  const deleteSection = async () => {
    const s = sections.find((x) => x.id === current)
    if (!s) return
    if (!confirm(`"${s.name}" qovluğu və içindəki hər şey silinsin?`)) return
    const paths = list.map((i) => i.path)
    if (paths.length) await supabase.storage.from('media').remove(paths)
    await supabase.from('sections').delete().eq('id', current)
    reload()
  }

  const upload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length || !current) return
    setUploading(true)
    for (const f of files) {
      const type = f.type.startsWith('video') ? 'video' : 'image'
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${current}/${Date.now()}-${safe}`
      const { error } = await supabase.storage.from('media').upload(path, f)
      if (error) {
        alert(`${f.name}: ${error.message}`)
        continue
      }
      const { data } = supabase.storage.from('media').getPublicUrl(path)
      await supabase.from('items').insert({
        section_id: current,
        type,
        url: data.publicUrl,
        path,
        name: f.name,
        visible: false,
      })
    }
    e.target.value = ''
    setUploading(false)
    reload()
  }

  const toggle = async (item) => {
    await supabase.from('items').update({ visible: !item.visible }).eq('id', item.id)
    reload()
  }

  const remove = async (item) => {
    if (!confirm('Bu fayl silinsin?')) return
    await supabase.storage.from('media').remove([item.path])
    await supabase.from('items').delete().eq('id', item.id)
    reload()
  }

  const setAll = async (val) => {
    await supabase.from('items').update({ visible: val }).eq('section_id', current)
    reload()
  }

  return (
    <div className="content">
      <div className="tabs">
        {sections.map((s) => (
          <button key={s.id} className={s.id === current ? 'tab active' : 'tab'} onClick={() => setCurrent(s.id)}>
            {s.name}
            <span className="count">{items.filter((i) => i.section_id === s.id).length}</span>
          </button>
        ))}
        <button className="tab add" onClick={addSection}>+ Yeni qovluq</button>
      </div>

      {current ? (
        <>
          <div className="toolbar">
            <label className="primary filebtn">
              {uploading ? 'Yüklənir...' : '+ Şəkil / Video əlavə et'}
              <input type="file" accept="image/*,video/*" multiple hidden disabled={uploading} onChange={upload} />
            </label>
            <button onClick={() => setAll(true)}>Hamısını göstər</button>
            <button onClick={() => setAll(false)}>Hamısını gizlət</button>
            <button className="danger" onClick={deleteSection}>Qovluğu sil</button>
          </div>

          {!list.length && <p className="empty">Bu qovluq boşdur.</p>}

          <div className="grid">
            {list.map((i) => (
              <div className={i.visible ? 'media-card on' : 'media-card'} key={i.id}>
                <Media item={i} onOpen={setOpen} />
                <div className="bar">
                  <label className="check">
                    <input type="checkbox" checked={i.visible} onChange={() => toggle(i)} />
                    Göstər
                  </label>
                  <button className="danger small" onClick={() => remove(i)}>Sil</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="empty">Başlamaq üçün "+ Yeni qovluq" düyməsinə basın.</p>
      )}
      <Lightbox item={open} onClose={() => setOpen(null)} />
    </div>
  )
}

/* ---------------- Əsas ---------------- */
export default function App() {
  const [role, setRole] = useState(sessionStorage.getItem('role'))
  const [sections, setSections] = useState([])
  const [items, setItems] = useState([])

  const reload = useCallback(async () => {
    const [s, i] = await Promise.all([
      supabase.from('sections').select('*').order('created_at'),
      supabase.from('items').select('*').order('created_at', { ascending: false }),
    ])
    setSections(s.data || [])
    setItems(i.data || [])
  }, [])

  useEffect(() => {
    if (!role) return
    reload()
    const ch = supabase
      .channel('live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sections' }, reload)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [role, reload])

  const logout = () => {
    sessionStorage.removeItem('role')
    setRole(null)
  }

  function refr() {
  window.location.reload();
}


  if (!role) return <Login onLogin={setRole} />

  return (
    <>
      <header>
        <strong>Tur Qalereyası</strong>
        <span>{role === 'admin' ? 'Admin' : '<button onClick={refr}>Yenilə</button>'}</span>
        <button onClick={logout}>Çıxış</button>
      </header>
      {role === 'admin' ? (
        <AdminView sections={sections} items={items} reload={reload} />
      ) : (
        <UserView sections={sections} items={items} />
      )}
    </>
  )
}
