"use client";

import React,{useEffect,useState} from "react";
import { supabase } from "@/app/lib/supabase";
import { useParams } from "next/navigation";

export default function TeamDetail(){

const {id} = useParams()

const [team,setTeam] = useState<any>(null)
const [comment,setComment] = useState("")

useEffect(()=>{
load()
},[])

async function load(){

const {data} = await supabase
.from("teams")
.select("*")
.eq("id",id)
.single()

setTeam(data)

}

async function requestMatch(){

const {data:{user}} = await supabase.auth.getUser()

if(!user){
alert("ログインしてください")
return
}

const {data:myTeam} = await supabase
.from("teams")
.select("id")
.eq("owner_id",user.id)
.single()

if(!myTeam){
alert("先にチーム登録してください")
return
}

const {data:slot} = await supabase
.from("match_slots")
.select("id")
.eq("host_team_id",id)
.eq("is_closed",false)
.limit(1)
.single()

if(!slot){
alert("現在募集している試合がありません")
return
}

const {data:request} = await supabase
.from("match_requests")
.insert({
slot_id:slot.id,
requester_team_id:myTeam.id,
requester_user_id:user.id,
status:"pending",
comment
})
.select()
.single()

// チャット自動生成

await supabase
.from("chat_threads")
.insert({
request_id:request.id
})

alert("試合申込しました")

}

if(!team)return <main>Loading...</main>

return(

<main style={{maxWidth:700,margin:"0 auto",padding:20}}>

<h1>{team.name}</h1>

<div>エリア {team.area}</div>

<div>カテゴリ {team.category}</div>

<div>強さ {team.strength_rank || team.level}</div>

<div style={{marginTop:20}}>

<textarea
placeholder="コメント"
value={comment}
onChange={e=>setComment(e.target.value)}
className="sh-input"
/>

<button
onClick={requestMatch}
className="sh-btn sh-btn--primary"
>
試合申込
</button>

</div>

</main>

)

}