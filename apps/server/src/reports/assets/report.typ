// Template do relatório do Atria. Os dados entram por `data.json`, gerado do modelo:
// a paleta do tema claro, a marca e o documento (título, período, filtros e blocos).
#let data = json("data.json")
#let p = data.palette
#let report = data.report
#let col(name) = rgb(p.at(name))
#let tone-color(tone) = if tone == "accent" {
  col("accent-fill")
} else if tone == "success" {
  col("success")
} else if tone == "warning" {
  col("warning")
} else if tone == "info" {
  col("info")
} else {
  col("primary")
}

#set document(title: report.title, author: data.brand)
#set page(
  paper: "a4",
  margin: (x: 18mm, top: 20mm, bottom: 22mm),
  fill: col("bg"),
  footer: context [
    #set text(size: 8pt, fill: col("text-muted"))
    #grid(
      columns: (1fr, auto),
      [#data.brand · gerado em #report.generated_on],
      [Página #counter(page).display() de #counter(page).final().first()],
    )
  ],
)
#set text(font: "Inter", size: 10pt, fill: col("text"), lang: "pt", region: "BR")
#set par(leading: 0.6em)

#text(font: "Outfit", weight: "semibold", size: 14pt, fill: col("primary"))[#data.brand]
#v(2pt)
#text(font: "Outfit", weight: "semibold", size: 22pt)[#report.title]
#v(2pt)
#text(fill: col("text-muted"))[#report.module_label · #report.description]
#v(8pt)
#if report.period != none [
  #text(weight: "semibold")[Período:] #report.period.label
] else [
  #text(weight: "semibold")[Estado em] #report.generated_on
]
#for f in report.filters [
  #linebreak()
  #text(weight: "semibold")[#f.label:] #f.value
]
#v(10pt)

#for s in report.sections [
  #block(
    width: 100%,
    fill: col("surface"),
    stroke: 0.5pt + col("border"),
    radius: 6pt,
    inset: 10pt,
    below: 10pt,
  )[
    #text(font: "Outfit", weight: "semibold", size: 13pt)[#s.title]
    #v(4pt)
    #if s.stats.len() > 0 [
      #grid(
        columns: s.stats.len() * (1fr,),
        gutter: 8pt,
        ..s.stats.map(st => [
          #text(size: 8pt, fill: col("text-muted"))[#st.label]
          #linebreak()
          #text(font: "Outfit", weight: "semibold", size: 15pt)[#st.value]
        ]),
      )
      #v(6pt)
    ]
    #if s.bars.len() > 0 [
      #for b in s.bars [
        #grid(
          columns: (34%, 1fr, 24%),
          gutter: 6pt,
          align: horizon,
          [#b.label],
          box(width: 100%, height: 7pt, fill: col("surface-muted"), radius: 3.5pt)[
            #rect(width: b.fraction * 100%, height: 7pt, fill: tone-color(b.tone), radius: 3.5pt)
          ],
          align(right)[#b.value_text],
        )
        #v(1pt)
      ]
      #v(4pt)
    ]
    #if s.table != none [
      #let t = s.table
      #text(size: 8pt, weight: "semibold", fill: col("text-muted"))[#t.caption]
      #v(2pt)
      #table(
        columns: (1fr,) + (auto,) * (t.columns.len() - 1),
        align: (left,) + (right,) * (t.columns.len() - 1),
        inset: (x: 6pt, y: 4pt),
        fill: (_, y) => if y == 0 { col("surface-muted") },
        stroke: (bottom: 0.5pt + col("border")),
        ..t.columns.map(c => text(weight: "semibold")[#c]),
        ..t.rows.flatten(),
      )
    ]
    #if s.stats.len() == 0 and s.bars.len() == 0 and s.table == none [
      #text(fill: col("text-muted"))[Sem dados neste período.]
    ]
  ]
]

#for n in report.notes [
  #text(size: 8.5pt, fill: col("text-muted"))[#n]
  #linebreak()
]
