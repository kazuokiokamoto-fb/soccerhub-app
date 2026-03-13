"use client";

import React,{useEffect,useState} from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function TeamSearch(){

const [teams,setTeams] = useState<any[]>([])
const [keyword,setKeyword] = useState("")

useEffect(()=>{
load()
},[])

async function load(){

const {data} = await supabase
.from("teams")
.select("*")
.order("created_at",{ascending:false})

setTeams(data||[])

}

async function search(){

const {data} = await supabase
.from("teams")
.select("*")
.ilike("name",`%${keyword}%`)

setTeams(data||[])

}

return(

<main style={{maxWidth:900,margin:"0 auto",padding:20}}>

<h1>チーム検索</h1>

<div style={{display:"flex",gap:10}}>

<input
value={keyword}
onChange={e=>setKeyword(e.target.value)}
placeholder="チーム名検索"
className="sh-input"
/>

<button
onClick={search}
className="sh-btn"
>
検索
</button>

</div>

<div style={{marginTop:20}}>

{teams.map(t=>(

<div key={t.id} style={card}>

<b>{t.name}</b>

<div>{t.area}</div>

<div>強さ {t.strength_rank || t.level}</div>

<Link
href={`/teams/${t.id}`}
className="sh-btn"
>
詳細
</Link>

</div>

))}

</div>

</main>

)

}

const card:React.CSSProperties={
padding:12,
border:"1px solid #eee",
borderRadius:10,
marginTop:10
}