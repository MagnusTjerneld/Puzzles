// Jugz vessels: the hand-built SVG for each skin's vessel (jug, wine glass, stein) and the pieces they share
// (the liquid surface, the etched capacity and the clip that decides which copy of it shows).
// Moved over unchanged from the standalone Jugz; the reasoning behind each piece is in the comments below and in
// CLAUDE.md. Uses caps, skin and UNIT from game.js (same function scope, called after they are set).
//
// Every generator publishes the band the liquid moves through (data-top/data-bot) and the shape of its surface
// (data-cx/-rx/-ry/-prof) on its <svg>, and emits the same element ids (water<i>, wrect<i>, surfg<i>, clip<i>, ...),
// so render() in game.js never needs to know which skin is on.

function wavePath(w2,lam,amp,depth){
  let d='M0 0';let x=0,s=-1;
  while(x<w2){d+=' q '+(lam/4)+' '+(s*amp)+' '+(lam/2)+' 0';x+=lam/2;s*=-1;}
  d+=' V '+(depth||7)+' H 0 Z';
  return d;
}
/* ---- The liquid surface, shared by every skin ----
   The surface of a liquid in a round vessel is an ellipse, so the line
   where it meets the glass has to bow the way the rim does. A flat top
   edge under a curved rim was the one thing that kept the vessels
   reading as flat cut-outs.

   Drawn in the surface group's own coordinates - y=0 is the liquid
   line, x is the vessel's centre - and only at its widest: render()
   scales the whole group to the width the vessel actually has at the
   level the liquid stands, which is the entire difference between a
   stein and the bowl of a wine glass.

   Three pieces. The ellipse is the top face of the liquid, the near half
   of it hanging below the line. The wings fill the two corners the near
   half leaves standing, down to the level where the body rect takes
   over, so the liquid's own top edge follows the arc rather than the
   line. The drifting waves are clipped to the ellipse, so what used to
   be a straight foam band now ripples inside the surface.

   The wings run a unit PAST the top of the body rect on purpose. Two
   shapes that merely meet along a line each anti-alias their own edge,
   and two half-covered pixels do not add up to one covered pixel: the
   backdrop showed through as a dark hairline straight across the liquid
   at exactly the level of the surface. The surface group is painted
   after the rect, so the overlap costs nothing but the seam. */
function surfaceSVG(idx,cx,rx,ry,lam){
  const w2=Math.round(2*rx)+2*lam;
  const x0=(cx-rx).toFixed(1),x1=(cx+rx).toFixed(1),R=rx.toFixed(1),Y=ry.toFixed(1);
  const out=(cx+rx*1.35).toFixed(1),in_=(cx-rx*1.35).toFixed(1),B=(ry+1.2).toFixed(1);
  const wing=`M ${in_} ${B} L ${in_} 0 L ${x0} 0 A ${R} ${Y} 0 0 0 ${x1} 0 L ${out} 0 L ${out} ${B} Z`;
  const near=`M ${x1} 0 A ${R} ${Y} 0 0 1 ${x0} 0`;
  const far=`M ${x0} 0 A ${R} ${Y} 0 0 1 ${x1} 0`;
  const wx=(cx-rx-lam).toFixed(1);
  return `<clipPath id="sclip${idx}"><ellipse cx="${cx}" cy="0" rx="${R}" ry="${Y}"/></clipPath>
        <path d="${wing}" fill="var(--water-hi)"/>
        <ellipse cx="${cx}" cy="0" rx="${R}" ry="${Y}" fill="var(--water-hi)"/>
        <g clip-path="url(#sclip${idx})">
          <g class="wavedrift rev" style="--lam:${lam}px;--wd:5.2s;transform-origin:0 0">
            <path d="${wavePath(w2,lam,1.5,ry+2)}" fill="var(--foam)" fill-opacity=".22" transform="translate(${wx} ${(-ry*0.15).toFixed(1)})"/>
          </g>
          <g class="wavedrift" style="--lam:${lam}px;--wd:4.2s">
            <path d="${wavePath(w2,lam,1.9,ry+2)}" fill="var(--foam)" fill-opacity=".5" transform="translate(${wx} ${(ry*0.3).toFixed(1)})"/>
          </g>
        </g>
        <path d="${far}" fill="none" stroke="var(--foam)" stroke-opacity=".28" stroke-width="1.6"/>
        <path d="${near}" fill="none" stroke="var(--foam)" stroke-opacity=".7" stroke-width="2"/>`;
}
/* The capacity mark, twice over: see the .etch rules for why. Both copies
   are the same glyphs in the same place, so nothing about the layout
   changes - the second one only darkens, and only where the liquid is
   behind it. */
function etchSVG(idx,x,y,fs,label){
  return `<text class="etch" x="${x}" y="${y}" text-anchor="middle" font-size="${fs}">${label}</text>
    <text class="etch etchmul" clip-path="url(#eclip${idx})" x="${x}" y="${y}" text-anchor="middle" font-size="${fs}">${label}</text>`;
}
/* The clip that decides which copy of the mark applies where: everything
   the liquid actually covers. Not a line across the glass - the same
   shapes the liquid is drawn with, so the mark changes over exactly the
   pixels the liquid is behind. Three pieces, matching the three the
   liquid is painted with: the body below the line (a rect, sharing the
   waterrect class so it transitions in step), the surface ellipse that
   stands above the line, and on a stein the head, whose lumpy top edge
   is the real boundary there.

   The two curved pieces are drawn in the surface group's coordinates, so
   render() gives them the transform it gives the surface group. They
   carry it one by one rather than in a <g>, because a clipPath only
   takes shapes as children.

   (One thing this does not follow: the head's surge after a pour, which
   is a CSS animation on the drawn foam and cannot be on a clip child
   that already carries a transform. For a second or so a stein poured
   into has a little more foam than the clip knows about.) */
function eclipSVG(idx,W,H,cx,rx,ry,head){
  return `<clipPath id="eclip${idx}">
      <rect class="waterrect" id="erect${idx}" x="0" y="${H}" width="${W}" height="0"/>
      <ellipse id="eell${idx}" cx="${cx}" cy="0" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>
      ${head?`<path id="efoam${idx}" d="${head}"/>`:''}
    </clipPath>`;
}
/* Nine samples of the inside half-width of the vessel, evenly spaced down
   the band the liquid moves through and given relative to the widest of
   them. Published as data-prof next to the band itself; render() reads it
   to size the surface. Any future vessel owes one. */
function bandProfile(top,bot,halfAt){
  const s=[];
  for(let k=0;k<=8;k++)s.push(halfAt(top+(bot-top)*k/8));
  const rx=Math.max(...s);
  return {rx:+rx.toFixed(1),prof:s.map(v=>(v/rx).toFixed(3)).join(',')};
}
/* Straight-line interpolation through a handful of (y, half-width)
   anchors - enough for the vessels whose walls are drawn by eye. */
function halfLerp(a,y){
  if(y<=a[0][0])return a[0][1];
  for(let k=1;k<a.length;k++)if(y<=a[k][0]){
    const[y0,h0]=a[k-1],[y1,h1]=a[k];
    return h0+(h1-h0)*(y-y0)/(y1-y0);
  }
  return a[a.length-1][1];
}
function jugSVG(idx,cap){
  const maxCap=Math.max(...caps);
  const H=Math.round(130+(cap/maxCap)*140);
  const bodyW=Math.round(64+(cap/maxCap)*36);
  const W=bodyW+30;
  const bx=6,x2=bx+bodyW;
  /* The mouth is an ellipse too, now that the water in it is one: the
     near half closes the body path, the far half is the faint stroke
     below - the same two-piece rim the glass and the stein carry. A
     straight mouth over a curved surface reads as a fold in the jug. */
  const mrx=((x2-8)-(bx+15))/2,mry=Math.max(4,Math.round(mrx*0.17));
  const path=`M ${bx} 14
    Q ${bx+7} 9 ${bx+15} 13
    A ${mrx.toFixed(1)} ${mry} 0 0 0 ${x2-8} 15
    Q ${x2-1} 16 ${x2-2} 25
    Q ${x2-9} ${Math.round(H*0.32)} ${x2-3} ${Math.round(H*0.55)}
    Q ${x2+3} ${Math.round(H*0.76)} ${x2-7} ${H-15}
    Q ${x2-9} ${H-10} ${x2-17} ${H-10}
    L ${bx+17} ${H-10}
    Q ${bx+9} ${H-10} ${bx+7} ${H-15}
    Q ${bx-3} ${Math.round(H*0.76)} ${bx+3} ${Math.round(H*0.55)}
    Q ${bx+9} ${Math.round(H*0.32)} ${bx+2} 25
    Q ${bx+1} 17 ${bx} 14 Z`;
  const handle=`M ${x2-4} 32
    C ${x2+22} ${Math.round(H*0.28)} ${x2+22} ${Math.round(H*0.52)} ${x2-5} ${Math.round(H*0.62)}`;
  const fs=Math.max(17,Math.round(H*0.13));
  const lam=Math.max(24,Math.round(bodyW/2));
  let bubbles='';
  for(let k=0;k<4;k++){
    const cx=bx+12+((idx*37+k*53)%(bodyW-24));
    const r=(1.6+((idx+k)%3)*0.7).toFixed(1);
    bubbles+='<circle class="waterbub" cx="'+cx+'" cy="'+(H-14)+'" r="'+r
      +'" fill="rgba(255,255,255,.4)" style="--bh:'+H+'px;--bd:'+(4.5+k*1.6+idx*0.7).toFixed(1)+'s;--bdl:'+(k*1.3).toFixed(1)+'s"/>';
  }
  /* data-top/data-bot is the band the liquid moves through, and data-rx
     /-ry/-cx/-prof is the shape of its surface (see surfaceSVG). The jug
     fills nearly to the brim; a wine glass does not, so render() reads
     both off the SVG instead of hardcoding them. The band starts just
     below the middle of the mouth, so a full jug reads as filled to
     just under the brim all the way round rather than to a line. */
  const cx=bx+bodyW/2,top=20,bot=H-10;
  const{rx,prof}=bandProfile(top,bot,y=>halfLerp([[14,(bodyW-8)/2],[26,(bodyW-4)/2],
    [H*0.32,(bodyW-9)/2],[H*0.55,(bodyW-6)/2],[H*0.76,(bodyW+3)/2],
    [H-15,(bodyW-12)/2],[H-9,(bodyW-30)/2]],y));
  const sry=rx*0.17;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-top="${top}" data-bot="${bot}"
    data-cx="${cx}" data-rx="${rx}" data-ry="${sry.toFixed(1)}" data-prof="${prof}">
    <defs>
      <!-- The clip is the body PLUS the whole mouth ellipse. The body path
           can only close along the near half of the mouth, so without the
           ellipse the far half of the water is cut away and a full jug
           shows an empty crescent inside its own opening: the liquid has
           to be visible through the opening, not stop below it. -->
      <clipPath id="clip${idx}"><path d="${path}"/><ellipse cx="${((bx+15)+(x2-8))/2}" cy="14" rx="${mrx.toFixed(1)}" ry="${mry}"/></clipPath>
      <clipPath id="wclip${idx}"><rect class="waterrect" id="wrect${idx}" x="0" y="${H}" width="${W}" height="0"/></clipPath>
      ${eclipSVG(idx,W,H,cx,rx,sry)}
      <linearGradient id="wg${idx}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--water-hi)"/>
        <stop offset="1" stop-color="var(--water-lo)"/>
      </linearGradient>
    </defs>
    <path class="glasshandle" d="${handle}"/>
    <path d="${path}" fill="var(--tint)"/>
    <rect class="waterrect" id="water${idx}" clip-path="url(#clip${idx})"
      x="0" y="${H}" width="${W}" height="0" fill="url(#wg${idx})"/>
    <g clip-path="url(#clip${idx})"><g clip-path="url(#wclip${idx})">${bubbles}</g></g>
    <g clip-path="url(#clip${idx})">
      <g class="surfg" id="surfg${idx}" style="transform:translateY(${H}px);opacity:0">
        ${surfaceSVG(idx,cx,rx,sry,lam)}
      </g>
    </g>
    <path d="M ${bx+12} 32 Q ${bx+6} ${Math.round(H*0.55)} ${bx+13} ${H-24}"
      fill="none" stroke="rgba(255,255,255,.45)" stroke-width="3" stroke-linecap="round"/>
    <path class="rimback" d="M ${bx+15} 13 A ${mrx.toFixed(1)} ${mry} 0 0 1 ${x2-8} 15"/>
    <path class="glassbody" d="${path}"/>
    ${etchSVG(idx,bx+bodyW/2,Math.round(H*0.60),fs,cap+' '+UNIT.water)}
  </svg>`;
}

/* ---- Winez: stemware ----
   Capacity drives bowl height, bowl width, belly bulge and stem length at
   once, so the three glasses of a level differ by silhouette and not only
   by size: the smallest reads as a port tulip, the largest as a burgundy
   balloon. Element ids match jugSVG exactly, so render() is skin-blind. */
function glassGeom(cap,maxCap){
  const r=cap/maxCap;
  const rimY=16;                          /* centre of the rim ellipse   */
  const ry=Math.round(5+r*3);             /* rim ellipse, minor radius   */
  const bowlH=Math.round(60+r*54);
  const bowlW=Math.round(52+r*46);
  const stemH=Math.round(46+r*54);
  const rimR=bowlW/2;
  const belly=rimR*(1+r*0.26);            /* tulip -> balloon            */
  const footRx=belly*0.78;
  const W=Math.ceil(2*belly+20);
  const cx=Math.round(W/2);
  const by=rimY+bowlH;                    /* bowl bottom = stem junction */
  const footY=by+stemH;
  return {rimY,ry,bowlH,bowlW,stemH,rimR,belly,footRx,W,cx,by,footY,H:footY+12};
}
function glassSVG(idx,cap){
  const g=glassGeom(cap,Math.max(...caps));
  const n=4;                              /* half-width at the neck      */
  const bowl=`M ${g.cx-g.rimR} ${g.rimY}
    C ${(g.cx-g.belly).toFixed(1)} ${(g.rimY+g.bowlH*0.36).toFixed(1)}
      ${(g.cx-g.belly*0.90).toFixed(1)} ${(g.rimY+g.bowlH*0.74).toFixed(1)}
      ${g.cx-n} ${g.by}
    L ${g.cx+n} ${g.by}
    C ${(g.cx+g.belly*0.90).toFixed(1)} ${(g.rimY+g.bowlH*0.74).toFixed(1)}
      ${(g.cx+g.belly).toFixed(1)} ${(g.rimY+g.bowlH*0.36).toFixed(1)}
      ${g.cx+g.rimR} ${g.rimY}
    A ${g.rimR} ${g.ry} 0 0 1 ${g.cx-g.rimR} ${g.rimY} Z`;
  /* The near half of the rim closes the bowl above; the far half is drawn
     separately and faintly. Without it the shape reads as a cone. */
  const rimBack=`M ${g.cx-g.rimR} ${g.rimY} A ${g.rimR} ${g.ry} 0 0 1 ${g.cx+g.rimR} ${g.rimY}`;
  const stem=`M ${g.cx-n} ${g.by}
    C ${g.cx-3.6} ${(g.by+g.stemH*0.5).toFixed(1)} ${g.cx-3.8} ${g.footY-18} ${g.cx-8} ${g.footY-2}
    L ${g.cx+8} ${g.footY-2}
    C ${g.cx+3.8} ${g.footY-18} ${g.cx+3.6} ${(g.by+g.stemH*0.5).toFixed(1)} ${g.cx+n} ${g.by} Z`;
  const shine=`M ${(g.cx-g.rimR*0.60).toFixed(1)} ${g.rimY+12}
    Q ${(g.cx-g.belly*0.88).toFixed(1)} ${(g.rimY+g.bowlH*0.48).toFixed(1)}
      ${(g.cx-g.rimR*0.34).toFixed(1)} ${g.by-10}`;
  const fs=Math.max(14,Math.round(g.bowlW*0.24));
  const lam=Math.max(24,Math.round(g.bowlW/2));
  /* Only the horizontal placing and the stagger are fixed here. How far a
     tear falls is not knowable until a pour happens, so runLegs writes
     --ls and --lg. Each tear hangs ABOVE its own origin: what runLegs
     parks at the wine is the tear's tail, and a tear must never be seen
     below the surface - it is on the inside of the glass, and the wine
     takes it. */
  let legs='';
  for(let k=0;k<3;k++){
    const lx=(g.cx-g.rimR*0.55+(g.rimR*1.1/2)*k+((idx*7+k*11)%9)).toFixed(1);
    legs+='<line class="leg" x1="'+lx+'" y1="-13" x2="'+lx+'" y2="0" stroke="var(--foam)"'
      +' stroke-width="2" stroke-linecap="round" style="--ld:'
      +(0.45+k*0.16+(idx%3)*0.05).toFixed(2)+'s"/>';
  }
  /* The band stops at the bottom of the bowl: the jug's band would pour
     wine down into the stem. The bowl is the vessel whose width changes
     most as the level moves, so its profile is measured off the very
     cubic the outline is drawn with rather than guessed at. */
  const byz=(t,p0,p1,p2,p3)=>{const u=1-t;return u*u*u*p0+3*u*u*t*p1+3*u*t*t*p2+t*t*t*p3;};
  const top=g.rimY+4,bot=g.by-3;
  const{rx,prof}=bandProfile(top,bot,y=>{
    let lo=0,hi=1;
    for(let k=0;k<24;k++){
      const m=(lo+hi)/2;
      if(byz(m,g.rimY,g.rimY+g.bowlH*0.36,g.rimY+g.bowlH*0.74,g.by)<y)lo=m;else hi=m;
    }
    return Math.max(3,g.cx-byz((lo+hi)/2,g.cx-g.rimR,g.cx-g.belly,g.cx-g.belly*0.90,g.cx-n));
  });
  const sry=rx*0.17;
  return `<svg width="${g.W}" height="${g.H}" viewBox="0 0 ${g.W} ${g.H}" data-top="${top}" data-bot="${bot}"
    data-cx="${g.cx}" data-rx="${rx}" data-ry="${sry.toFixed(1)}" data-prof="${prof}">
    <defs>
      <!-- Body plus the whole rim ellipse: see jugSVG. Without it the far
           half of the wine is cut off at the rim. -->
      <clipPath id="clip${idx}"><path d="${bowl}"/><ellipse cx="${g.cx}" cy="${g.rimY}" rx="${g.rimR}" ry="${g.ry}"/></clipPath>
      <clipPath id="wclip${idx}"><rect class="waterrect" id="wrect${idx}" x="0" y="${g.H}" width="${g.W}" height="0"/></clipPath>
      ${eclipSVG(idx,g.W,g.H,g.cx,rx,sry)}
      <linearGradient id="wg${idx}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--water-hi)"/>
        <stop offset="1" stop-color="var(--water-lo)"/>
      </linearGradient>
    </defs>
    <ellipse cx="${g.cx}" cy="${g.footY}" rx="${g.footRx.toFixed(1)}" ry="6" fill="var(--tint)" stroke="var(--glass)" stroke-width="2.2"/>
    <path class="stemshape" d="${stem}"/>
    <path d="${bowl}" fill="var(--tint)"/>
    <rect class="waterrect" id="water${idx}" clip-path="url(#clip${idx})"
      x="0" y="${g.H}" width="${g.W}" height="0" fill="url(#wg${idx})"/>
    <g clip-path="url(#clip${idx})">
      <g class="surfg" id="surfg${idx}" style="transform:translateY(${g.H}px);opacity:0">
        ${surfaceSVG(idx,g.cx,rx,sry,lam)}
      </g>
      <g class="legsg" id="legsg${idx}" style="transform:translateY(${g.H}px)">${legs}</g>
    </g>
    <path d="${shine}" fill="none" stroke="rgba(255,255,255,.40)" stroke-width="3" stroke-linecap="round"/>
    <path class="rimback" d="${rimBack}"/>
    <path class="glassbody" d="${bowl}"/>
    ${etchSVG(idx,g.cx,Math.round(g.rimY+g.bowlH*0.62),fs,cap+' '+UNIT.wine)}
  </svg>`;
}
/* ---- Beerz: the German stein ----
   A dimpled Masskrug: near-straight walls with a slight draw towards the
   base, a thick D-handle, pressed dimples across the glass and a head of
   foam on top. Capacity drives height, width and the depth of the head
   together. The element ids are jugSVG's and glassSVG's again, so
   render() stays skin-blind.

   Two things are the stein's own. The band stops well short of the rim -
   data-top leaves the head room to stand inside the glass, the way the
   wine band stops at the bottom of the bowl - and the foam sits inside
   surfg rather than beside it, so it rides the beer line with no help
   from render(). The bubbles come back here: fizz is wrong for a still
   red and exactly right for a lager. */
function steinGeom(cap,maxCap){
  const r=cap/maxCap;
  const bodyW=Math.round(68+r*44);
  const H=Math.round(146+r*104);
  const rimY=14;                          /* centre of the rim ellipse   */
  const ry=Math.round(6+r*3);             /* rim ellipse, minor radius   */
  const bx=8,x2=bx+bodyW;
  const baseY=H-16;                       /* the inside of the base      */
  const taper=Math.round(bodyW*0.05);     /* the walls draw in a little  */
  const head=Math.round(12+r*9);          /* the foam head, at rest      */
  const proj=Math.round(bodyW*0.36);      /* how far the handle reaches  */
  const W=bodyW+Math.round(bodyW*0.30)+18;
  return {r,bodyW,H,rimY,ry,bx,x2,baseY,taper,head,proj,W,rimR:bodyW/2};
}
/* The top of the head, lumpy rather than level: a straight edge reads as
   a lid. Drawn in the surface group's own coordinates, where y=0 is the
   beer line and the foam stands above it. The underside is the near half
   of the surface ellipse, not a line: the head sits on the beer, so it
   hangs down in the middle exactly as far as the beer does. */
function foamPath(x0,x1,hh,cx,rx,ry){
  const n=4,step=(x1-x0)/n;
  let d='M '+x0+' 0 L '+x0+' '+(-hh*0.62).toFixed(1);
  for(let k=0;k<n;k++){
    const sx=x0+k*step;
    d+=' Q '+(sx+step*0.25).toFixed(1)+' '+(-hh*(k%2?1.12:0.94)).toFixed(1)
      +' '+(sx+step*0.5).toFixed(1)+' '+(-hh*0.82).toFixed(1)
      +' Q '+(sx+step*0.76).toFixed(1)+' '+(-hh*(k%2?0.58:0.72)).toFixed(1)
      +' '+(sx+step).toFixed(1)+' '+(-hh*0.80).toFixed(1);
  }
  d+=' L '+x1+' 0 L '+(cx+rx).toFixed(1)+' 0'
    +' A '+rx.toFixed(1)+' '+ry.toFixed(1)+' 0 0 1 '+(cx-rx).toFixed(1)+' 0 Z';
  return d;
}
function steinSVG(idx,cap){
  const g=steinGeom(cap,Math.max(...caps));
  const {bx,x2,rimY,ry,baseY,taper,bodyW,H,W,rimR,proj}=g;
  const body=`M ${bx} ${rimY}
    L ${bx+taper} ${baseY-12}
    Q ${bx+taper} ${baseY} ${bx+taper+12} ${baseY}
    L ${x2-taper-12} ${baseY}
    Q ${x2-taper} ${baseY} ${x2-taper} ${baseY-12}
    L ${x2} ${rimY}
    A ${rimR} ${ry} 0 0 1 ${bx} ${rimY} Z`;
  /* The far half of the rim, faint - the same trick as the wine glass:
     without it the mouth of the stein reads as a flat top. */
  const rimBack=`M ${bx} ${rimY} A ${rimR} ${ry} 0 0 1 ${x2} ${rimY}`;
  /* The ring round the neck, where the pressed part of the glass starts.
     It runs the other way from the far half of the rim: this is the near
     side of a band wrapped round the mug, so it bows downwards, and it
     bows less than the rim does because it is further below the eye. */
  const bandY=rimY+Math.round((baseY-rimY)*0.13);
  const band=`M ${bx+1} ${bandY} A ${rimR} ${Math.round(ry*0.62)} 0 0 0 ${x2-1} ${bandY}`;
  const wall=baseY-rimY;
  /* A stein is carried by the fist, so the handle is a wide D standing
     well off the wall - not the thumb loop a jug gets. It is also short
     and sits low: it grips the bottom half of the mug, nowhere near the
     rim, which is what keeps it from reading as a jug handle. */
  const hy1=Math.round(rimY+wall*0.36),hy2=Math.round(rimY+wall*0.76);
  const handle=`M ${x2-5} ${hy1}
    C ${x2+proj} ${hy1-4} ${x2+proj} ${hy2+4} ${x2-5} ${hy2}`;
  const shine=`M ${bx+12} ${rimY+26} Q ${bx+6} ${Math.round(rimY+wall*0.55)} ${bx+14} ${baseY-26}`;
  const fs=Math.max(17,Math.round(H*0.12));
  const lam=Math.max(24,Math.round(bodyW/2));
  let bubbles='';
  for(let k=0;k<4;k++){
    const cx=bx+12+((idx*37+k*53)%Math.max(12,bodyW-24));
    const r=(1.6+((idx+k)%3)*0.7).toFixed(1);
    bubbles+='<circle class="waterbub" cx="'+cx+'" cy="'+(baseY-4)+'" r="'+r
      +'" fill="rgba(255,255,255,.4)" style="--bh:'+H+'px;--bd:'+(4.5+k*1.6+idx*0.7).toFixed(1)+'s;--bdl:'+(k*1.3).toFixed(1)+'s"/>';
  }
  /* The pressed dimples of a Masskrug, drawn over the beer as well as
     over the empty glass: they are the wall, not a decoration on it.
     Big and close-packed, three to a row with the offset row running off
     both edges - the half dimples the silhouette cuts are what make the
     wall read as curved rather than as a panel of dots.

     The rows are laid out to a count, not to a fixed pitch: even the
     smallest mug is worth three rows, and one row is always given up to
     the capacity mark, so four is where the count starts. */
  let dimples='';
  /* The top quarter of the glass stays smooth: a real Masskrug is
     pressed from below the neck ring down, and it is also where the head
     sits. */
  const top=rimY+Math.max(30,Math.round(wall*0.28)),bot=baseY-20,avail=bot-top,drMax=bodyW*0.16;
  const rowN=Math.max(4,Math.round(avail/(2.1*drMax))+1);
  const gap=Math.min(2.1*drMax,avail/(rowN-1)),dr=Math.min(drMax,gap/2.1);
  const start=top+(avail-(rowN-1)*gap)/2;
  /* The band the capacity is etched on stays smooth, the way the fill
     mark on a real Masskrug does - dimpling straight through the number
     is what makes it hard to read. The number takes a whole row rather
     than a slice of one, so the gap it sits in looks deliberate. */
  const skip=Math.max(1,Math.round((rowN-1)*0.62));
  const etchY=Math.round(start+skip*gap+fs*0.34);
  for(let ri=0;ri<rowN;ri++){
    if(ri===skip)continue;
    const dy=(start+ri*gap).toFixed(1);
    const at=(ri%2)?[0,1/3,2/3,1]:[1/6,0.5,5/6];
    for(const f of at)
      dimples+='<ellipse cx="'+(bx+bodyW*f).toFixed(1)+'" cy="'+dy+'" rx="'+dr.toFixed(1)+'" ry="'+(dr*0.94).toFixed(1)
        +'" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.19)" stroke-width="1.5"/>';
  }
  const hh=g.head;
  const cx=bx+bodyW/2,bandTop=rimY+hh+6,bandBot=baseY-3;
  const{rx,prof}=bandProfile(bandTop,bandBot,y=>{
    const t=Math.max(0,Math.min(1,(y-rimY)/wall));
    return Math.max(4,(bodyW-2*taper*t)/2-Math.max(0,y-(baseY-12))*0.9);
  });
  const sry=rx*0.17;
  let holes='';
  for(let k=0;k<5;k++){
    const hx=(bx+8+((idx*23+k*41)%Math.max(12,bodyW-16))).toFixed(1);
    holes+='<circle class="foamhole" cx="'+hx+'" cy="'+(-hh*(0.28+0.14*(k%3))).toFixed(1)+'" r="'
      +(1.5+(k%3)*0.5).toFixed(1)+'" fill="var(--water-lo)" fill-opacity=".16"'
      +' style="--fd:'+(22+k*5.5+idx*2.5).toFixed(1)+'s;--fdl:-'+(k*7+idx*3)+'s"/>';
  }
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-top="${bandTop}" data-bot="${bandBot}"
    data-cx="${cx}" data-rx="${rx}" data-ry="${sry.toFixed(1)}" data-prof="${prof}">
    <defs>
      <!-- Body plus the whole rim ellipse: see jugSVG. Here it is the head
           that needs it - foam stands in the mouth of the stein. -->
      <clipPath id="clip${idx}"><path d="${body}"/><ellipse cx="${bx+bodyW/2}" cy="${rimY}" rx="${rimR}" ry="${ry}"/></clipPath>
      <clipPath id="wclip${idx}"><rect class="waterrect" id="wrect${idx}" x="0" y="${H}" width="${W}" height="0"/></clipPath>
      ${eclipSVG(idx,W,H,cx,rx,sry,foamPath(bx-3,x2+3,hh,cx,rx,sry))}
      <linearGradient id="wg${idx}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--water-hi)"/>
        <stop offset="1" stop-color="var(--water-lo)"/>
      </linearGradient>
    </defs>
    <path class="glasshandle" d="${handle}"/>
    <path d="${body}" fill="var(--tint)"/>
    <rect class="waterrect" id="water${idx}" clip-path="url(#clip${idx})"
      x="0" y="${H}" width="${W}" height="0" fill="url(#wg${idx})"/>
    <g clip-path="url(#clip${idx})"><g clip-path="url(#wclip${idx})">${bubbles}</g></g>
    <g clip-path="url(#clip${idx})">
      <g class="surfg" id="surfg${idx}" style="transform:translateY(${H}px);opacity:0">
        ${surfaceSVG(idx,cx,rx,sry,lam)}
        <g class="headg" id="headg${idx}">
          <g class="headb" style="--hb:${(38+idx*5).toFixed(1)}s">
            <path d="${foamPath(bx-3,x2+3,hh,cx,rx,sry)}" fill="var(--foam)"/>
            ${holes}
          </g>
        </g>
      </g>
      ${dimples}
    </g>
    <path d="${shine}" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="3" stroke-linecap="round"/>
    <path class="rimback" d="${rimBack}"/>
    <path class="glassband" d="${band}"/>
    <path class="glassbody" d="${body}"/>
    ${etchSVG(idx,bx+bodyW/2,etchY,fs,cap+' '+UNIT.beer)}
  </svg>`;
}
function vesselSVG(idx,cap){
  if(skin==='wine')return glassSVG(idx,cap);
  if(skin==='beer')return steinSVG(idx,cap);
  return jugSVG(idx,cap);
}
