"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type Slot = {
  id: string
  date: string
  start_time: string
  end_time: string
  area: string | null
  category: string | null
  is_closed: boolean
}

type Request = {
  id: string
  slot_id: string
  requester_team_id: string
  requester_user_id: string
  status: string
  comment: string | null
  created_at: string
}

function rankLabel(level:number){
  if(level>=9) return "SS"
  if(level>=7) return "S"
  if(level>=5) return "A"
  if(level>=3) return "B"
  return "C"
}

export default function TeamsPage(){

  const [me,setMe] = useState<any>(null)
  const [team,setTeam] = useState<any>(null)

  const [mySlots,setMySlots] = useState<Slot[]>([])
  const [myRequests,setMyRequests] = useState<Request[]>([])
  const [requestsToMe,setRequestsToMe] = useState<Request[]>([])

  const [loading,setLoading] = useState(true)
  const [unreadChatCount,setUnreadChatCount] = useState(0)

  useEffect(()=>{
    load()
  },[])

  async function load(){

    const {data:{user}} = await supabase.auth.getUser()
    if(!user)return

    setMe(user)

    const {data:teams} = await supabase
      .from("teams")
      .select("*")
      .eq("owner_id",user.id)
      .limit(1)

    const myTeam = teams?.[0]
    setTeam(myTeam)

    const {data:slots} = await supabase
      .from("match_slots")
      .select("*")
      .eq("owner_id",user.id)

    setMySlots(slots || [])

    const {data:reqs} = await supabase
      .from("match_requests")
      .select("*")
      .eq("requester_user_id",user.id)

    setMyRequests(reqs || [])

    if(myTeam){

      const {data:reqToMe} = await supabase
        .from("match_requests")
        .select("*")
        .eq("host_team_id",myTeam.id)

      setRequestsToMe(reqToMe || [])
    }

    // 未読チャット
    const {data:threads} = await supabase
      .from("chat_threads")
      .select("unread_count")

    const unread =
      threads?.reduce((sum:any,t:any)=>sum+(t.unread_count||0),0) || 0

    setUnreadChatCount(unread)

    setLoading(false)
  }

  async function cancelRequest(id:string){

    if(!confirm("申込をキャンセルしますか？"))return

    await supabase
      .from("match_requests")
      .update({status:"cancelled"})
      .eq("id",id)

    load()
  }

  async function closeSlot(id:string){

    if(!confirm("募集を締め切りますか？"))return

    await supabase
      .from("match_slots")
      .update({is_closed:true})
      .eq("id",id)

    load()
  }

  if(loading)
    return <main style={{padding:20}}>Loading...</main>

  return(
  <main style={{maxWidth:900,margin:"0 auto",padding:20}}>

  <h1>マイページ</h1>

  {/* 上部メニュー */}

  <div style={menuRow}>

  <Link
  href="/teams/new"
  className="sh-btn sh-btn--primary"
  >
  ＋チーム登録
  </Link>

  <Link
  href="/mypage/account"
  className="sh-btn"
  >
  👤アカウント設定
  </Link>

  <Link
  href="/chat"
  className="sh-btn"
  >
  💬チャット

  {unreadChatCount>0 &&(
  <span style={badge}>
  未読 {unreadChatCount}
  </span>
  )}

  </Link>

  </div>

  {/* アカウント */}

  <section style={box}>

  <h2>アカウント</h2>

  <div>メール : {me?.email}</div>

  </section>

  {/* チーム */}

  <section style={box}>

  <h2>自分のチーム</h2>

  {team &&(
  <>

  <div>チーム名 : {team.name}</div>

  <div>カテゴリ : {team.category}</div>

  <div>
  強さ :
  {team.strength_rank || rankLabel(team.level)}
  </div>

  <div>エリア : {team.area}</div>

  <Link
  href={`/teams/${team.id}/edit`}
  className="sh-btn"
  >
  チーム編集
  </Link>

  </>
  )}

  </section>

  {/* 自分の募集 */}

  <section style={box}>

  <h2>自分の試合募集</h2>

  {mySlots.map(s=>(
  <div key={s.id} style={card}>

  <b>

  {s.date}

  {" "}

  {s.start_time.slice(0,5)}

  -

  {s.end_time.slice(0,5)}

  </b>

  <div>{s.area}</div>

  <div>
  状態 : {s.is_closed?"締切":"募集中"}
  </div>

  {!s.is_closed &&(

  <button
  className="sh-btn"
  onClick={()=>closeSlot(s.id)}
  >
  募集締切
  </button>

  )}

  </div>
  ))}

  </section>

  {/* 自分の申込 */}

  <section style={box}>

  <h2>自分の試合申込</h2>

  {myRequests.map(r=>(
  <div key={r.id} style={card}>

  <div>状態 : {r.status}</div>

  {r.comment &&(
  <div style={{color:"#555"}}>
  {r.comment}
  </div>
  )}

  {r.status==="pending" &&(

  <button
  className="sh-btn"
  onClick={()=>cancelRequest(r.id)}
  >
  申込キャンセル
  </button>

  )}

  </div>
  ))}

  </section>

  {/* オファー */}

  <section style={box}>

  <h2>自分の募集への申込</h2>

  {requestsToMe.map(r=>(
  <div key={r.id} style={card}>

  <div>状態 : {r.status}</div>

  {r.comment &&(
  <div>{r.comment}</div>
  )}

  </div>
  ))}

  </section>

  </main>
  )
}

const menuRow:React.CSSProperties={
display:"flex",
gap:10,
marginBottom:20
}

const badge:React.CSSProperties={
marginLeft:8,
background:"#ef4444",
color:"#fff",
padding:"2px 6px",
borderRadius:8,
fontSize:12
}

const box:React.CSSProperties={
padding:16,
border:"1px solid #eee",
borderRadius:12,
marginBottom:20
}

const card:React.CSSProperties={
padding:12,
border:"1px solid #eee",
borderRadius:10,
marginTop:10
}