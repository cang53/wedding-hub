<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
:root{
  color-scheme: light;
  --bg:#f2f2f7; --card:#ffffff; --cardedge:0 solid transparent; --r:12px;
  --fg:#000000; --fg2:#6c6c70; --fg3:#a1a1a6;
  --sep:rgba(60,60,67,.17); --fill:rgba(120,120,128,.14);
  --accent:#c2415f; --green:#2f9e4f; --red:#c9332b; --amber:#a67512;
  --nav:rgba(246,246,248,.8);
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue","Segoe UI",sans-serif;
}
:root[data-theme="dark"]{
  color-scheme: dark;
  --bg:#000000; --card:#1c1c1e; --fg:#ffffff; --fg2:#98989e; --fg3:#6c6c70;
  --sep:rgba(84,84,88,.6); --fill:rgba(120,120,128,.24);
  --accent:#ff6f8d; --green:#30d158; --red:#ff453a; --amber:#ffd60a;
  --nav:rgba(20,20,22,.8);
}
:root[data-flavor="plain"]{ --bg:#ffffff; --card:#ffffff; --r:0px; --cardedge:1px solid var(--sep); --nav:rgba(255,255,255,.82); }
:root[data-flavor="plain"][data-theme="dark"]{ --bg:#000000; --card:#000000; --nav:rgba(0,0,0,.82); }
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--fg);font-family:var(--font);-webkit-font-smoothing:antialiased;}
button{font-family:inherit;color:inherit;}
a{color:var(--accent);text-decoration:none;}
a:hover{opacity:.7;}
</style>
</helmet>

<div style="min-height:100vh;display:flex;background:var(--bg);color:var(--fg);">

  <sc-if value="{{ isDesktop }}" hint-placeholder-val="{{ true }}">
    <aside style="position:sticky;top:0;height:100vh;width:236px;flex:0 0 236px;display:flex;flex-direction:column;gap:24px;padding:20px 12px;background:var(--nav);backdrop-filter:saturate(180%) blur(22px);-webkit-backdrop-filter:saturate(180%) blur(22px);border-right:1px solid var(--sep);">
      <div style="padding:4px 10px 0;">
        <div style="font-size:17px;font-weight:600;letter-spacing:-.02em;">Celal &amp; Selver</div>
        <div style="font-size:13px;color:var(--fg2);margin-top:2px;">5 September 2026</div>
      </div>
      <nav style="display:flex;flex-direction:column;gap:1px;">
        <sc-for list="{{ navItems }}" as="n" hint-placeholder-count="5">
          <button onClick="{{ n.go }}" style="{{ n.style }}" style-hover="background:var(--fill);">{{ n.label }}</button>
        </sc-for>
      </nav>
      <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding:6px 10px;">
        <span style="font-size:13px;color:var(--fg2);">Dark</span>
        <button onClick="{{ toggleTheme }}" aria-label="Toggle appearance" style="{{ switchTrack }}"><span style="{{ switchKnob }}"></span></button>
      </div>
    </aside>
  </sc-if>

  <main style="flex:1;min-width:0;">

    <header style="position:sticky;top:0;z-index:20;padding:16px clamp(16px,3vw,40px) 12px;background:var(--nav);backdrop-filter:saturate(180%) blur(22px);-webkit-backdrop-filter:saturate(180%) blur(22px);border-bottom:1px solid var(--sep);display:flex;align-items:center;justify-content:space-between;gap:16px;">
      <h1 style="margin:0;font-size:clamp(26px,3.4vw,34px);font-weight:700;letter-spacing:-.026em;line-height:1.1;">{{ screenTitle }}</h1>
      <div style="display:flex;align-items:center;gap:12px;">
        <sc-if value="{{ isMobile }}" hint-placeholder-val="{{ false }}">
          <button onClick="{{ toggleTheme }}" aria-label="Toggle appearance" style="{{ switchTrack }}"><span style="{{ switchKnob }}"></span></button>
        </sc-if>
        <button style="border:none;background:none;padding:0;font-size:16px;font-weight:400;letter-spacing:-.01em;color:var(--accent);cursor:pointer;white-space:nowrap;" style-hover="opacity:.6;">{{ primaryAction }}</button>
      </div>
    </header>

    <div style="padding:22px clamp(16px,3vw,40px) 120px;max-width:1000px;">

      <!-- ============ OVERVIEW ============ -->
      <sc-if value="{{ isOverview }}" hint-placeholder-val="{{ true }}">
        <section data-screen-label="Overview" style="display:flex;flex-direction:column;gap:30px;">

          <div style="padding:6px 4px 0;">
            <div style="display:flex;align-items:baseline;gap:12px;">
              <span style="font-size:clamp(60px,10vw,96px);font-weight:700;letter-spacing:-.05em;line-height:.86;font-variant-numeric:tabular-nums;">{{ daysLeft }}</span>
              <span style="font-size:clamp(19px,2.4vw,26px);font-weight:600;letter-spacing:-.02em;color:var(--fg2);">days to go</span>
            </div>
            <div style="font-size:16px;color:var(--fg2);margin-top:14px;letter-spacing:-.012em;">Saturday 5 September 2026 · Antwerp</div>
          </div>

          <div>
            <div style="{{ groupLabel }}">Where things stand</div>
            <div style="{{ groupBox }}">
              <sc-for list="{{ standing }}" as="s" hint-placeholder-count="3">
                <div style="{{ s.outer }}">
                  <div style="{{ s.inner }}">
                    <span style="font-size:17px;letter-spacing:-.014em;">{{ s.label }}</span>
                    <span style="margin-left:auto;font-size:17px;color:var(--fg2);font-variant-numeric:tabular-nums;letter-spacing:-.014em;">{{ s.value }}</span>
                  </div>
                </div>
              </sc-for>
            </div>
          </div>

          <div>
            <div style="{{ groupLabel }}">Next up</div>
            <div style="{{ groupBox }}">
              <sc-for list="{{ upcoming }}" as="e" hint-placeholder-count="5">
                <div style="{{ e.outer }}">
                  <div style="{{ e.inner }}">
                    <div style="min-width:0;">
                      <div style="font-size:17px;letter-spacing:-.014em;">{{ e.title }}</div>
                      <div style="font-size:14px;color:var(--fg2);margin-top:2px;letter-spacing:-.008em;">{{ e.sub }}</div>
                    </div>
                    <span style="margin-left:auto;font-size:15px;color:var(--fg2);white-space:nowrap;font-variant-numeric:tabular-nums;">{{ e.when }}</span>
                  </div>
                </div>
              </sc-for>
            </div>
          </div>

          <div>
            <div style="{{ groupLabel }}">{{ tasksLabel }}</div>
            <div style="{{ groupBox }}">
              <sc-for list="{{ tasks }}" as="t" hint-placeholder-count="5">
                <div style="{{ t.outer }}">
                  <button onClick="{{ t.toggle }}" style="{{ t.inner }}" style-hover="opacity:.72;">
                    <span style="{{ t.boxStyle }}">{{ t.check }}</span>
                    <span style="{{ t.textStyle }}">{{ t.text }}</span>
                    <span style="{{ t.prioStyle }}">{{ t.priority }}</span>
                  </button>
                </div>
              </sc-for>
            </div>
          </div>
        </section>
      </sc-if>

      <!-- ============ LIFE AFTER ============ -->
      <sc-if value="{{ isLife }}" hint-placeholder-val="{{ false }}">
        <section data-screen-label="Life After" style="display:flex;flex-direction:column;gap:28px;">

          <div style="{{ segWrap }}">
            <sc-for list="{{ lifeTabs }}" as="t" hint-placeholder-count="3">
              <button onClick="{{ t.go }}" style="{{ t.style }}">{{ t.label }}</button>
            </sc-for>
          </div>

          <div style="padding:2px 4px;">
            <div style="font-size:clamp(38px,6vw,54px);font-weight:700;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums;">{{ leftOver }}</div>
            <div style="font-size:16px;color:var(--fg2);margin-top:12px;letter-spacing:-.012em;">{{ leftOverSub }}</div>
          </div>

          <div>
            <div style="{{ groupLabel }}">Projected cash · {{ cashRange }}</div>
            <div style="{{ groupBoxPad }}">
              <div style="display:flex;align-items:flex-end;gap:clamp(3px,.9vw,9px);height:150px;">
                <sc-for list="{{ cashSeries }}" as="m" hint-placeholder-count="12">
                  <div style="flex:1;height:100%;display:flex;align-items:flex-end;" title="{{ m.tip }}">
                    <div style="{{ m.barStyle }}"></div>
                  </div>
                </sc-for>
              </div>
              <div style="display:flex;gap:clamp(3px,.9vw,9px);border-top:1px solid var(--sep);padding-top:8px;margin-top:10px;">
                <sc-for list="{{ cashSeries }}" as="m" hint-placeholder-count="12">
                  <div style="{{ m.tickStyle }}">{{ m.short }}</div>
                </sc-for>
              </div>
              <div style="font-size:13px;color:var(--fg2);margin-top:12px;letter-spacing:-.006em;">{{ cashCaption }}</div>
            </div>
          </div>

          <div>
            <div style="{{ groupLabel }}">Income each month</div>
            <div style="{{ groupBox }}">
              <sc-for list="{{ income }}" as="i" hint-placeholder-count="3">
                <div style="{{ i.outer }}">
                  <div style="{{ i.inner }}">
                    <div>
                      <div style="font-size:17px;letter-spacing:-.014em;">{{ i.label }}</div>
                      <div style="font-size:14px;color:var(--fg2);margin-top:2px;">{{ i.who }}</div>
                    </div>
                    <span style="margin-left:auto;font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:-.014em;">{{ i.amount }}</span>
                  </div>
                </div>
              </sc-for>
            </div>
          </div>

          <div>
            <div style="{{ groupLabel }}">Costs each month</div>
            <div style="{{ groupBox }}">
              <sc-for list="{{ expenses }}" as="x" hint-placeholder-count="8">
                <div style="{{ x.outer }}">
                  <div style="{{ x.inner }}">
                    <span style="font-size:17px;letter-spacing:-.014em;">{{ x.label }}</span>
                    <span style="margin-left:auto;font-size:17px;color:var(--fg2);font-variant-numeric:tabular-nums;letter-spacing:-.014em;">{{ x.amount }}</span>
                  </div>
                </div>
              </sc-for>
            </div>
          </div>

          <div>
            <div style="{{ groupLabel }}">Planned purchases</div>
            <div style="{{ groupBox }}">
              <sc-for list="{{ purchases }}" as="p" hint-placeholder-count="4">
                <div style="{{ p.outer }}">
                  <div style="{{ p.inner }}">
                    <div style="min-width:0;">
                      <div style="font-size:17px;letter-spacing:-.014em;">{{ p.label }}</div>
                      <div style="font-size:14px;color:var(--fg2);margin-top:2px;">{{ p.sub }}</div>
                    </div>
                    <span style="margin-left:auto;font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:-.014em;white-space:nowrap;">{{ p.amount }}</span>
                  </div>
                </div>
              </sc-for>
            </div>
          </div>
        </section>
      </sc-if>

      <!-- ============ HONEYMOON ============ -->
      <sc-if value="{{ isHoney }}" hint-placeholder-val="{{ false }}">
        <section data-screen-label="Honeymoon" style="display:flex;flex-direction:column;gap:24px;">
          <div style="{{ segWrap }}">
            <sc-for list="{{ honeyTabs }}" as="t" hint-placeholder-count="2">
              <button onClick="{{ t.go }}" style="{{ t.style }}">{{ t.label }}</button>
            </sc-for>
          </div>

          <sc-if value="{{ honeyCards }}" hint-placeholder-val="{{ true }}">
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;">
              <sc-for list="{{ scenarios }}" as="s" hint-placeholder-count="3">
                <article style="{{ s.cardStyle }}">
                  <div style="padding:20px 20px 18px;display:flex;flex-direction:column;gap:14px;flex:1;">
                    <div>
                      <div style="{{ s.tagStyle }}">{{ s.tag }}</div>
                      <h3 style="margin:6px 0 0;font-size:24px;font-weight:680;letter-spacing:-.03em;">{{ s.name }}</h3>
                      <p style="margin:6px 0 0;font-size:15px;color:var(--fg2);letter-spacing:-.012em;">{{ s.description }}</p>
                    </div>
                    <div style="font-size:15px;letter-spacing:-.012em;">{{ s.route }}</div>
                    <div style="font-size:14px;color:var(--fg2);">{{ s.meta }}</div>
                    <div style="margin-top:auto;display:flex;align-items:baseline;gap:10px;">
                      <span style="font-size:28px;font-weight:680;letter-spacing:-.035em;font-variant-numeric:tabular-nums;">{{ s.net }}</span>
                      <span style="{{ s.strikeStyle }}">{{ s.total }}</span>
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:18px;padding:12px 20px;border-top:1px solid var(--sep);">
                    <button style="border:none;background:none;padding:0;font-size:15px;color:var(--accent);cursor:pointer;" style-hover="opacity:.6;">Edit</button>
                    <button style="border:none;background:none;padding:0;font-size:15px;color:var(--accent);cursor:pointer;" style-hover="opacity:.6;">Duplicate</button>
                    <button onClick="{{ s.select }}" style="{{ s.selectStyle }}">{{ s.selectLabel }}</button>
                  </div>
                </article>
              </sc-for>
            </div>
          </sc-if>

          <sc-if value="{{ honeyCompare }}" hint-placeholder-val="{{ false }}">
            <div style="{{ groupBox }}">
              <sc-for list="{{ compareRows }}" as="r" hint-placeholder-count="8">
                <div style="{{ r.outer }}">
                  <div style="{{ r.inner }}">
                    <div style="{{ r.labelStyle }}">{{ r.label }}</div>
                    <sc-for list="{{ r.cells }}" as="c" hint-placeholder-count="3">
                      <div style="{{ c.style }}">{{ c.text }}</div>
                    </sc-for>
                  </div>
                </div>
              </sc-for>
            </div>
          </sc-if>
        </section>
      </sc-if>

      <!-- ============ GUESTS ============ -->
      <sc-if value="{{ isGuests }}" hint-placeholder-val="{{ false }}">
        <section data-screen-label="Guests" style="display:flex;flex-direction:column;gap:24px;">

          <div style="padding:2px 4px;">
            <div style="font-size:clamp(38px,6vw,54px);font-weight:700;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums;">{{ guestHeadline }}</div>
            <div style="font-size:16px;color:var(--fg2);margin-top:12px;letter-spacing:-.012em;">{{ guestSub }}</div>
            <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;background:var(--fill);margin-top:18px;max-width:520px;">
              <sc-for list="{{ rsvpBar }}" as="b" hint-placeholder-count="3">
                <div style="{{ b.style }}" title="{{ b.tip }}"></div>
              </sc-for>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <sc-for list="{{ guestFilters }}" as="f" hint-placeholder-count="6">
              <button onClick="{{ f.go }}" style="{{ f.style }}">{{ f.label }}</button>
            </sc-for>
          </div>

          <div style="{{ groupBox }}">
            <sc-for list="{{ visibleGuests }}" as="g" hint-placeholder-count="8">
              <div style="{{ g.outer }}">
                <div style="{{ g.inner }}">
                  <div style="min-width:0;">
                    <div style="font-size:17px;letter-spacing:-.014em;">{{ g.name }}</div>
                    <div style="font-size:14px;color:var(--fg2);margin-top:2px;letter-spacing:-.008em;">{{ g.sub }}</div>
                  </div>
                  <div style="margin-left:auto;display:flex;align-items:center;gap:8px;white-space:nowrap;">
                    <span style="{{ g.dotStyle }}"></span>
                    <span style="font-size:15px;color:var(--fg2);letter-spacing:-.01em;">{{ g.rsvp }}</span>
                  </div>
                </div>
              </div>
            </sc-for>
          </div>
        </section>
      </sc-if>

      <!-- ============ THE DAY ============ -->
      <sc-if value="{{ isDay }}" hint-placeholder-val="{{ false }}">
        <section data-screen-label="The Day" style="display:flex;flex-direction:column;gap:26px;">
          <div style="{{ segWrap }}">
            <sc-for list="{{ dayTabs }}" as="t" hint-placeholder-count="3">
              <button onClick="{{ t.go }}" style="{{ t.style }}">{{ t.label }}</button>
            </sc-for>
          </div>

          <div style="font-size:16px;color:var(--fg2);padding:0 4px;letter-spacing:-.012em;">{{ dayCaption }}</div>

          <sc-for list="{{ phases }}" as="ph" hint-placeholder-count="4">
            <div>
              <div style="{{ groupLabel }}">{{ ph.label }}</div>
              <div style="{{ groupBox }}">
                <sc-for list="{{ ph.events }}" as="e" hint-placeholder-count="3">
                  <div style="{{ e.outer }}">
                    <div style="{{ e.inner }}">
                      <div style="width:64px;flex:0 0 64px;">
                        <div style="font-size:17px;font-weight:590;font-variant-numeric:tabular-nums;letter-spacing:-.02em;">{{ e.start }}</div>
                        <div style="font-size:13px;color:var(--fg3);font-variant-numeric:tabular-nums;margin-top:2px;">{{ e.duration }}</div>
                      </div>
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:17px;letter-spacing:-.014em;">{{ e.title }}</div>
                        <div style="font-size:14px;color:var(--fg2);margin-top:2px;letter-spacing:-.008em;">{{ e.sub }}</div>
                      </div>
                      <span style="{{ e.badgeStyle }}">{{ e.badge }}</span>
                    </div>
                  </div>
                </sc-for>
              </div>
            </div>
          </sc-for>
        </section>
      </sc-if>

    </div>
  </main>

  <sc-if value="{{ isMobile }}" hint-placeholder-val="{{ false }}">
    <nav style="position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;padding:9px 4px calc(9px + env(safe-area-inset-bottom));background:var(--nav);backdrop-filter:saturate(180%) blur(22px);-webkit-backdrop-filter:saturate(180%) blur(22px);border-top:1px solid var(--sep);">
      <sc-for list="{{ navItems }}" as="n" hint-placeholder-count="5">
        <button onClick="{{ n.go }}" style="{{ n.tabStyle }}">{{ n.short }}</button>
      </sc-for>
    </nav>
  </sc-if>

</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;$preview&quot;:{&quot;width&quot;:1280,&quot;height&quot;:900},&quot;flavor&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;grouped&quot;,&quot;plain&quot;],&quot;default&quot;:&quot;grouped&quot;,&quot;tsType&quot;:&quot;string&quot;,&quot;section&quot;:&quot;Direction&quot;},&quot;theme&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;light&quot;,&quot;dark&quot;],&quot;default&quot;:&quot;light&quot;,&quot;tsType&quot;:&quot;string&quot;,&quot;section&quot;:&quot;Direction&quot;},&quot;accent&quot;:{&quot;editor&quot;:&quot;color&quot;,&quot;options&quot;:[&quot;#c2415f&quot;,&quot;#0071e3&quot;,&quot;#1d1d1f&quot;,&quot;#2f9e4f&quot;],&quot;default&quot;:&quot;#c2415f&quot;,&quot;tsType&quot;:&quot;string&quot;,&quot;section&quot;:&quot;Direction&quot;}}">
const WEDDING_DATE = "2026-09-05";

const money = (n) => new Intl.NumberFormat("fr-BE", {
  style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(n);

const INCOME = [
  { label: "Celal", who: "Salary, net", amount: 3450 },
  { label: "Selver", who: "Salary, net", amount: 2980 },
  { label: "Freelance", who: "Six-month average", amount: 400 },
];

const EXPENSES = [
  { label: "Rent", amount: 1250 }, { label: "Groceries", amount: 620 },
  { label: "Dining and leisure", amount: 450 }, { label: "Transport", amount: 340 },
  { label: "Utilities", amount: 210 }, { label: "Insurance", amount: 185 },
  { label: "Phone and internet", amount: 95 }, { label: "Subscriptions", amount: 60 },
];

const PURCHASES = [
  { label: "Living room sofa", sub: "October 2026 · two options shortlisted", amount: 1800, mIdx: 1 },
  { label: "Kitchen appliances", sub: "November 2026 · oven, hob, dishwasher", amount: 2400, mIdx: 2 },
  { label: "Bedroom set", sub: "January 2027 · bed frame and wardrobe", amount: 1600, mIdx: 4 },
  { label: "Car down payment", sub: "February 2027 · second-hand estate", amount: 4000, mIdx: 5 },
];

const GUESTS = [
  { name: "Ayşe Yıldırım", side: "bride", cat: "Family", plus: "Mehmet", rsvp: "yes" },
  { name: "Bram De Vos", side: "groom", cat: "Close friends", plus: "", rsvp: "yes" },
  { name: "Céline Moreau", side: "bride", cat: "Work", plus: "", rsvp: "pending" },
  { name: "Dilara Kaya", side: "bride", cat: "Family", plus: "Emre", rsvp: "yes" },
  { name: "Emma Janssens", side: "groom", cat: "Friends", plus: "", rsvp: "no" },
  { name: "Fatih Demir", side: "groom", cat: "Family", plus: "Zehra", rsvp: "yes" },
  { name: "Gökhan Aslan", side: "groom", cat: "Close friends", plus: "", rsvp: "pending" },
  { name: "Hannah Peeters", side: "bride", cat: "Work", plus: "", rsvp: "yes" },
  { name: "İrem Şahin", side: "bride", cat: "Close friends", plus: "Kerem", rsvp: "yes" },
  { name: "Jonas Willems", side: "groom", cat: "Work", plus: "", rsvp: "pending" },
  { name: "Katrien Maes", side: "both", cat: "Family", plus: "", rsvp: "yes" },
  { name: "Levent Öztürk", side: "groom", cat: "Family", plus: "Nur", rsvp: "no" },
  { name: "Marie Dubois", side: "bride", cat: "Friends", plus: "", rsvp: "yes" },
  { name: "Naz Erdoğan", side: "bride", cat: "Family", plus: "", rsvp: "pending" },
  { name: "Olivier Lambert", side: "groom", cat: "Friends", plus: "Sofie", rsvp: "yes" },
  { name: "Pelin Koç", side: "bride", cat: "Work", plus: "", rsvp: "yes" },
];

const EVENTS = [
  { t: "Hair and makeup", s: "08:00", e: "11:00", loc: "Bridal suite", note: "With the bridesmaids", who: "bride" },
  { t: "Groom preparation", s: "09:30", e: "11:00", loc: "Hotel room", note: "", who: "groom" },
  { t: "First look", s: "11:30", e: "12:00", loc: "Garden", note: "Private, photographer only", who: "both" },
  { t: "Ceremony", s: "13:00", e: "14:00", loc: "Chapel", note: "Guests seated by 12:30", who: "both" },
  { t: "Cocktail hour", s: "14:00", e: "15:30", loc: "Terrace", note: "", who: "both" },
  { t: "Family photos", s: "15:00", e: "16:00", loc: "Garden", note: "Shot list with Anke", who: "both" },
  { t: "Reception and dinner", s: "18:00", e: "20:00", loc: "Ballroom", note: "", who: "both" },
  { t: "Speeches", s: "19:00", e: "19:45", loc: "Ballroom", note: "Four speakers, eight minutes each", who: "both" },
  { t: "First dance", s: "20:00", e: "20:15", loc: "Dance floor", note: "", who: "both" },
  { t: "Cake cutting", s: "20:30", e: "20:45", loc: "Ballroom", note: "", who: "both" },
  { t: "Dancing", s: "21:00", e: "23:30", loc: "Dance floor", note: "", who: "both" },
  { t: "Send-off", s: "23:30", e: "24:00", loc: "Entrance", note: "Sparklers", who: "both" },
];

const PHASE_DEFS = [
  { label: "Morning", from: 0, to: 11.25 },
  { label: "Ceremony", from: 11.25, to: 15 },
  { label: "Afternoon", from: 15, to: 18 },
  { label: "Dinner", from: 18, to: 21 },
  { label: "Evening", from: 21, to: 26 },
];

const SCENARIOS = [
  { id: "amalfi", name: "Amalfi and Capri", description: "Slow coast, long dinners, one boat day.",
    stages: [["Naples", 2], ["Positano", 4], ["Capri", 3]], total: 6420, net: 5980, promo: "SUMMER26", flights: 780, feel: "Relaxed" },
  { id: "japan", name: "Japan in autumn", description: "Cities, temples, an onsen at the end.",
    stages: [["Tokyo", 5], ["Kyoto", 4], ["Hakone", 2]], total: 8150, net: 8150, promo: "", flights: 1640, feel: "Busy" },
  { id: "greece", name: "Greek islands", description: "Two ferries, three beaches, no plans.",
    stages: [["Athens", 2], ["Naxos", 4], ["Santorini", 3]], total: 5240, net: 4990, promo: "EARLYBIRD", flights: 520, feel: "Easy" },
];

const TASKS = [
  { text: "Confirm the florist order", priority: "High" },
  { text: "Send the seating chart to the venue", priority: "High" },
  { text: "Book the hotel room block", priority: "Medium" },
  { text: "Choose the first-dance song", priority: "Medium" },
  { text: "Order thank-you cards", priority: "Low" },
];

const UPCOMING = [
  { title: "Venue walkthrough", sub: "With Katrien, 10:00", when: "12 Aug" },
  { title: "Cake tasting", sub: "Patisserie Verlinden", when: "18 Aug" },
  { title: "Invitations posted", sub: "86 envelopes", when: "22 Aug" },
  { title: "Suit fitting", sub: "Final alteration", when: "29 Aug" },
  { title: "Rehearsal dinner", sub: "Immediate family", when: "4 Sep" },
];

class Component extends DCLogic {
  state = {
    screen: "overview", theme: "light",
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    lifeView: "joint", dayView: "all", honeyView: "cards",
    guestFilter: "Everyone", finalId: "amalfi", done: {},
  };

  componentDidMount() {
    this.onResize = () => this.setState({ width: window.innerWidth });
    window.addEventListener("resize", this.onResize);
    const t = this.props.theme || "light";
    this.setState({ theme: t });
    document.documentElement.dataset.theme = t;
    document.documentElement.dataset.flavor = this.props.flavor || "grouped";
    if (this.props.accent) document.documentElement.style.setProperty("--accent", this.props.accent);
  }

  componentDidUpdate(prev) {
    if (prev.flavor !== this.props.flavor) document.documentElement.dataset.flavor = this.props.flavor || "grouped";
    if (prev.theme !== this.props.theme && this.props.theme) {
      document.documentElement.dataset.theme = this.props.theme;
      this.setState({ theme: this.props.theme });
    }
    if (prev.accent !== this.props.accent && this.props.accent) {
      document.documentElement.style.setProperty("--accent", this.props.accent);
    }
  }

  componentWillUnmount() { window.removeEventListener("resize", this.onResize); }

  toggleTheme = () => {
    const next = this.state.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    this.setState({ theme: next });
  };

  seg(active) {
    return "flex:1;height:30px;padding:0 14px;border-radius:7px;border:none;cursor:pointer;font-size:14px;font-weight:" +
      (active ? "590" : "450") + ";letter-spacing:-.01em;white-space:nowrap;transition:background .16s;background:" +
      (active ? "var(--card)" : "transparent") + ";color:var(--fg);box-shadow:" +
      (active ? "0 1px 2px rgba(0,0,0,.16)" : "none") + ";";
  }

  // Inset hairline: separator sits on the inner element so it stops short of the card edge.
  row(i, pad) {
    const p = pad === undefined ? 18 : pad;
    return {
      outer: "padding-left:" + p + "px;",
      inner: "display:flex;align-items:center;gap:14px;padding:12px " + p + "px 12px 0;text-align:left;width:100%;background:none;border:none;color:inherit;" +
        (i ? "border-top:1px solid var(--sep);" : ""),
    };
  }

  parse(t) { const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; }

  dur(a, b) {
    const mins = Math.round((this.parse(b) - this.parse(a)) * 60);
    if (mins < 60) return mins + " min";
    const h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? h + " h" : h + " h " + m;
  }

  renderVals() {
    const S = this.state;
    const isMobile = S.width < 900;
    const accent = "var(--accent)";
    const clock = (t) => (t === "24:00" ? "00:00" : t);

    const days = Math.max(0, Math.round((new Date(WEDDING_DATE) - new Date(new Date().toDateString())) / 86400000));

    const groupLabel = "font-size:13px;color:var(--fg2);letter-spacing:-.004em;padding:0 18px 7px;";
    const groupBox = "background:var(--card);border-radius:var(--r);border-top:var(--cardedge);border-bottom:var(--cardedge);overflow:hidden;";
    const groupBoxPad = groupBox + "padding:20px 18px 18px;";
    const segWrap = "display:flex;padding:2px;gap:2px;border-radius:9px;background:var(--fill);max-width:420px;";

    const navDefs = [["overview", "Overview", "Overview"], ["life", "Life after", "Life"],
      ["honey", "Honeymoon", "Trip"], ["guests", "Guests", "Guests"], ["day", "The day", "Day"]];
    const navItems = navDefs.map(([key, label, short]) => {
      const on = S.screen === key;
      return {
        key, label, short, go: () => this.setState({ screen: key }),
        style: "display:block;width:100%;padding:8px 10px;border:none;border-radius:8px;cursor:pointer;text-align:left;font-size:15px;letter-spacing:-.014em;font-weight:" +
          (on ? "590" : "440") + ";background:" + (on ? "var(--fill)" : "transparent") + ";color:" + (on ? accent : "var(--fg)") + ";",
        tabStyle: "flex:1;padding:6px 2px;border:none;background:none;cursor:pointer;font-size:12px;letter-spacing:-.005em;font-weight:" +
          (on ? "600" : "450") + ";color:" + (on ? accent : "var(--fg2)") + ";",
      };
    });

    // ---- Overview
    const doneCount = Object.values(S.done).filter(Boolean).length;
    const openTasks = TASKS.length - doneCount;
    const gYes = GUESTS.filter((g) => g.rsvp === "yes").length;
    const gNo = GUESTS.filter((g) => g.rsvp === "no").length;
    const gPend = GUESTS.filter((g) => g.rsvp === "pending").length;
    const gPlus = GUESTS.filter((g) => g.plus).length;
    const gTotal = GUESTS.length + gPlus;

    const standing = [
      { label: "Budget", value: money(12480) + " left" },
      { label: "Guests", value: gYes + " of " + gTotal + " confirmed" },
      { label: "Honeymoon", value: "3 scenarios, 1 chosen" },
    ].map((s, i) => ({ ...s, ...this.row(i) }));

    const upcoming = UPCOMING.map((e, i) => ({ ...e, ...this.row(i) }));

    const prioTone = { High: accent, Medium: "var(--fg2)", Low: "var(--fg3)" };
    const tasks = TASKS.map((t, i) => {
      const on = !!S.done[i];
      const r = this.row(i);
      return {
        text: t.text, priority: t.priority, check: on ? "✓" : "",
        toggle: () => this.setState((st) => ({ done: { ...st.done, [i]: !st.done[i] } })),
        outer: r.outer, inner: r.inner + "cursor:pointer;",
        boxStyle: "width:22px;height:22px;flex:0 0 22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;transition:all .18s;border:1.5px solid " +
          (on ? accent : "var(--sep)") + ";background:" + (on ? accent : "transparent") + ";",
        textStyle: "flex:1;font-size:17px;letter-spacing:-.014em;" + (on ? "color:var(--fg3);text-decoration:line-through;" : ""),
        prioStyle: "font-size:14px;white-space:nowrap;letter-spacing:-.008em;color:" + prioTone[t.priority] + ";" + (on ? "opacity:.4;" : ""),
      };
    });

    // ---- Life after
    const incTotal = INCOME.reduce((a, b) => a + b.amount, 0);
    const expTotal = EXPENSES.reduce((a, b) => a + b.amount, 0);
    const saving = 900;
    const net = incTotal - expTotal - saving;

    let cash = 8400;
    const months = ["S", "O", "N", "D", "J", "F", "M", "A", "M", "J", "J", "A"];
    const raw = months.map((m, i) => {
      cash += net + saving;
      const buy = PURCHASES.filter((p) => p.mIdx === i).reduce((a, b) => a + b.amount, 0);
      cash -= buy;
      return { short: m, value: cash, buy };
    });
    const maxCash = Math.max(...raw.map((r) => r.value));
    const cashSeries = raw.map((r) => ({
      short: r.short, tip: money(r.value),
      barStyle: "width:100%;height:" + Math.round((r.value / maxCash) * 100) + "%;min-height:4px;border-radius:2px;background:" +
        (r.buy ? accent : "var(--fill)") + ";",
      tickStyle: "flex:1;text-align:center;font-size:11px;color:var(--fg3);",
    }));

    const lifeTabs = [["joint", "Household"], ["groom", "Celal"], ["bride", "Selver"]].map(([v, l]) => ({
      label: l, go: () => this.setState({ lifeView: v }), style: this.seg(S.lifeView === v),
    }));

    const scale = S.lifeView === "joint" ? 1 : S.lifeView === "groom" ? 0.54 : 0.46;
    const shownIncome = S.lifeView === "joint" ? INCOME : INCOME.filter((_, i) => (S.lifeView === "groom" ? i !== 1 : i !== 0));
    const shownIncTotal = shownIncome.reduce((a, b) => a + b.amount, 0);
    const shownExpTotal = Math.round(expTotal * scale);
    const shownNet = shownIncTotal - shownExpTotal - Math.round(saving * scale);

    const income = shownIncome.map((i, k) => ({ label: i.label, who: i.who, amount: money(i.amount), ...this.row(k) }));
    const expenses = EXPENSES.map((x, k) => ({ label: x.label, amount: money(Math.round(x.amount * scale)), ...this.row(k) }));
    const purchases = PURCHASES.map((p, k) => ({ label: p.label, sub: p.sub, amount: money(p.amount), ...this.row(k) }));

    // ---- Honeymoon
    const honeyTabs = [["cards", "Scenarios"], ["compare", "Compare"]].map(([v, l]) => ({
      label: l, go: () => this.setState({ honeyView: v }), style: this.seg(S.honeyView === v),
    }));

    const nights = (s) => s.stages.reduce((a, b) => a + b[1], 0);
    const scenarios = SCENARIOS.map((s) => {
      const final = S.finalId === s.id;
      const disc = s.net < s.total;
      return {
        name: s.name, description: s.description,
        tag: final ? "Chosen" : s.feel,
        route: s.stages.map((st) => st[0]).join(" · "),
        meta: nights(s) + " nights · flights " + money(s.flights) + (disc ? " · " + s.promo : ""),
        net: money(disc ? s.net : s.total), total: disc ? money(s.total) : "",
        select: () => this.setState({ finalId: s.id }),
        selectLabel: final ? "Chosen" : "Choose",
        cardStyle: "display:flex;flex-direction:column;background:var(--card);border-radius:var(--r);border-top:var(--cardedge);border-bottom:var(--cardedge);overflow:hidden;" +
          (final ? "box-shadow:inset 0 0 0 1.5px " + accent + ";" : ""),
        tagStyle: "font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:" + (final ? accent : "var(--fg3)") + ";",
        strikeStyle: "font-size:16px;color:var(--fg3);text-decoration:line-through;font-variant-numeric:tabular-nums;",
        selectStyle: "margin-left:auto;border:none;background:none;padding:0;font-size:15px;font-weight:" +
          (final ? "590" : "400") + ";cursor:" + (final ? "default" : "pointer") + ";color:" + (final ? accent : "var(--accent)") + ";" +
          (final ? "opacity:1;" : ""),
      };
    });

    const mkRow = (label, fn, i, head) => {
      const r = this.row(i);
      return {
        label, outer: r.outer,
        inner: r.inner.replace("align-items:center", "align-items:baseline") + "display:grid;grid-template-columns:120px repeat(3,1fr);gap:10px;",
        labelStyle: "font-size:14px;color:var(--fg2);letter-spacing:-.008em;" + (head ? "color:var(--fg);font-weight:600;" : ""),
        cells: SCENARIOS.map((s) => ({
          text: fn(s),
          style: "font-size:" + (head ? "15px" : "15px") + ";text-align:right;font-variant-numeric:tabular-nums;letter-spacing:-.01em;" +
            (head ? "font-weight:640;" : "") + (S.finalId === s.id ? "color:" + accent + ";" : ""),
        })),
      };
    };
    const compareRows = [
      ["Scenario", (s) => s.name, true], ["Nights", (s) => String(nights(s))],
      ["Stages", (s) => String(s.stages.length)], ["Pace", (s) => s.feel],
      ["Flights", (s) => money(s.flights)], ["List price", (s) => money(s.total)],
      ["You pay", (s) => money(s.net)], ["Per night", (s) => money(Math.round(s.net / nights(s)))],
    ].map(([l, f, h], i) => mkRow(l, f, i, h));

    // ---- Guests
    const cats = ["Everyone", ...new Set(GUESTS.map((g) => g.cat))];
    const guestFilters = cats.map((c) => {
      const on = S.guestFilter === c;
      return {
        label: c, go: () => this.setState({ guestFilter: c }),
        style: "height:30px;padding:0 13px;border-radius:999px;cursor:pointer;font-size:14px;letter-spacing:-.01em;font-weight:" +
          (on ? "560" : "440") + ";border:none;background:" + (on ? "var(--fg)" : "var(--fill)") + ";color:" + (on ? "var(--bg)" : "var(--fg)") + ";",
      };
    });

    const rsvpBar = [
      { n: gYes, c: "var(--green)", t: gYes + " coming" },
      { n: gPend, c: "var(--amber)", t: gPend + " pending" },
      { n: gNo, c: "var(--red)", t: gNo + " declined" },
    ].map((b) => ({ tip: b.t, style: "width:" + ((b.n / GUESTS.length) * 100) + "%;background:" + b.c + ";" }));

    const rsvpTone = { yes: "var(--green)", no: "var(--red)", pending: "var(--amber)" };
    const rsvpText = { yes: "Coming", no: "Declined", pending: "Pending" };
    const sideText = { bride: "Selver's side", groom: "Celal's side", both: "Both sides" };
    const list = GUESTS.filter((g) => S.guestFilter === "Everyone" || g.cat === S.guestFilter);
    const visibleGuests = list.map((g, i) => ({
      name: g.name,
      sub: sideText[g.side] + (g.plus ? " · plus " + g.plus : ""),
      rsvp: rsvpText[g.rsvp],
      dotStyle: "width:7px;height:7px;border-radius:50%;background:" + rsvpTone[g.rsvp] + ";",
      ...this.row(i),
    }));

    // ---- The day
    const dayTabs = [["all", "Both"], ["bride", "Selver"], ["groom", "Celal"]].map(([v, l]) => ({
      label: l, go: () => this.setState({ dayView: v }), style: this.seg(S.dayView === v),
    }));

    const evts = EVENTS.filter((e) => S.dayView === "all" || e.who === S.dayView || e.who === "both")
      .slice().sort((a, b) => this.parse(a.s) - this.parse(b.s));
    const whoLabel = { bride: "Selver", groom: "Celal", both: "" };

    const phases = PHASE_DEFS.map((p) => {
      const inPhase = evts.filter((e) => { const h = this.parse(e.s); return h >= p.from && h < p.to; });
      return {
        label: p.label,
        events: inPhase.map((e, i) => {
          const r = this.row(i);
          return {
            title: e.t, start: e.s, duration: this.dur(e.s, e.e),
            sub: e.loc + (e.note ? " · " + e.note : ""),
            badge: whoLabel[e.who],
            outer: r.outer, inner: r.inner.replace("align-items:center", "align-items:flex-start"),
            badgeStyle: "font-size:14px;color:var(--fg2);white-space:nowrap;letter-spacing:-.008em;" + (e.who === "both" ? "display:none;" : ""),
          };
        }),
      };
    }).filter((p) => p.events.length);

    const first = evts[0], last = evts[evts.length - 1];

    const titles = {
      overview: ["Overview", "Add task"], life: ["Life after", "Add line"],
      honey: ["Honeymoon", "New scenario"], guests: ["Guests", "Add guest"], day: ["The day", "Add event"],
    };
    const [screenTitle, primaryAction] = titles[S.screen];
    const dark = S.theme === "dark";

    return {
      isDesktop: !isMobile, isMobile, navItems, screenTitle, primaryAction,
      groupLabel, groupBox, groupBoxPad, segWrap,
      toggleTheme: this.toggleTheme,
      switchTrack: "position:relative;width:47px;height:28px;border-radius:999px;border:none;padding:0;cursor:pointer;transition:background .22s;background:" +
        (dark ? accent : "var(--fill)") + ";",
      switchKnob: "position:absolute;top:2px;left:2px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .22s cubic-bezier(.4,1.25,.5,1);transform:translateX(" +
        (dark ? "19px" : "0") + ");",

      isOverview: S.screen === "overview", isLife: S.screen === "life",
      isHoney: S.screen === "honey", isGuests: S.screen === "guests", isDay: S.screen === "day",

      daysLeft: String(days), standing, upcoming, tasks,
      tasksLabel: openTasks === 0 ? "All done" : openTasks + (openTasks === 1 ? " task open" : " tasks open"),

      lifeTabs, income, expenses, purchases, cashSeries,
      leftOver: money(shownNet) + " left over",
      leftOverSub: money(shownIncTotal) + " in · " + money(shownExpTotal) + " out · " + money(Math.round(saving * scale)) + " to savings, every month",
      cashRange: "Sep 2026 to Aug 2027",
      cashCaption: "Ends at " + money(raw[raw.length - 1].value) + ". Highlighted months carry a planned purchase.",

      honeyTabs, scenarios, compareRows,
      honeyCards: S.honeyView === "cards", honeyCompare: S.honeyView === "compare",

      guestHeadline: gYes + " of " + gTotal + " coming",
      guestSub: gPend + " still to reply · " + gNo + " declined · " + gPlus + " plus ones",
      rsvpBar, guestFilters, visibleGuests,

      dayTabs, phases,
      dayCaption: evts.length + " events, " + (first ? first.s : "—") + " to " + (last ? clock(last.e) : "—"),
    };
  }
}
</script>
</body>
</html>
