import assert from "node:assert/strict";
import test from "node:test";
import { permitted, readConsent, requirePermission } from "../src/consent";
import { exportLesson } from "../src/agents/learning";
import { createManifest } from "../src/agents/provenance-agent";
import type { Story } from "../src/types";

const base = (): Story => ({
 id:"story-1",title:"Story",storyteller:"Elder",location:"Village",language:"Chichewa",region:"Southern Africa",license:"Community Tribal Copyright",createdAt:"2026-01-01T00:00:00Z",duration:1,audio:new Blob(["audio"]),audioSha256:"hash",transcript:"",
 learning:{audience:"Learners",objective:"Learn",nativeProverb:"",meaning:"",discussionQuestion:"Discuss",activity:"Retell",sessionsDelivered:0,classroomPermission:true}
});
test("historical stories default deny every protected use",()=>{
 const story=base();
 for(const use of ["record","store","share","backup","teach","commercial"] as const){
   assert.equal(permitted(story,use),false);
   assert.throws(()=>requirePermission(story,use));
 }
 assert.throws(()=>exportLesson(story));
});
test("consent choices are independent and commercial use defaults off",()=>{
 const form=new FormData();
 form.set("consentGiver","Elder");form.set("consentRole","storyteller");
 form.set("permission-record","on");form.set("permission-store","on");form.set("permission-teach","on");
 const consent=readConsent(form);
 const story={...base(),consent};
 assert.equal(permitted(story,"teach"),true);
 assert.equal(permitted(story,"share"),false);
 assert.equal(permitted(story,"backup"),false);
 assert.equal(permitted(story,"commercial"),false);
 assert.match(exportLesson(story),/Storyteller:/);
 const manifest=createManifest(story);
 assert.equal(manifest["pam:permissions"].teach,true);
 assert.equal(manifest["pam:permissions"].commercial,false);
 assert.equal(manifest["pam:provenanceStatus"],"unsigned");
});
test("recording and storage require explicit consent",()=>{
 const form=new FormData();form.set("consentGiver","Elder");form.set("consentRole","storyteller");
 assert.throws(()=>readConsent(form));
 form.set("permission-record","on");form.set("permission-store","on");
 assert.doesNotThrow(()=>readConsent(form));
});
test("classroom facilitator permission cannot override storyteller denial",()=>{
 const story=base();
 story.consent={version:1,giver:"Elder",role:"storyteller",recordedAt:new Date().toISOString(),permissions:{record:true,store:true,share:true,backup:true,teach:false,commercial:false}};
 assert.throws(()=>exportLesson(story));
 story.consent.permissions.teach=true;
 story.learning!.classroomPermission=false;
 assert.throws(()=>exportLesson(story));
});
