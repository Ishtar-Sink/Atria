//! Resumo da Visão geral do projeto (PD-42): progresso, raias, prazos próximos e o que
//! está em andamento, calculado em memória a partir do projeto e da data de hoje.
//! O servidor só marca o atraso (`overdue`); o tom é do frontend ([project/frontend-14]).

use chrono::{Duration, NaiveDate};
use uuid::Uuid;

use super::card::{Card, CardId, CardPriority};
use super::lane::{Lane, LaneId, SystemLane};
use super::project::Project;

/// Prazos em até 14 dias a partir de hoje, inclusive os vencidos.
pub const UPCOMING_DAYS: i64 = 14;
pub const UPCOMING_LIMIT: usize = 20;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SummaryProgress {
    pub done_cards: u32,
    pub total_cards: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaneSummary {
    pub lane_id: LaneId,
    pub system_key: Option<SystemLane>,
    pub name: Option<String>,
    pub color: String,
    pub counts_as_done: bool,
    pub card_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpcomingCard {
    pub card_id: CardId,
    pub lane_id: LaneId,
    pub title: String,
    pub due_date: NaiveDate,
    pub overdue: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InProgressCard {
    pub card_id: CardId,
    pub lane_id: LaneId,
    pub title: String,
    pub priority: Option<CardPriority>,
    pub due_date: Option<NaiveDate>,
    pub checklist_done: u32,
    pub checklist_total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProjectSummary {
    pub progress: SummaryProgress,
    pub lanes: Vec<LaneSummary>,
    pub upcoming_due: Vec<UpcomingCard>,
    pub in_progress: Vec<InProgressCard>,
}

fn count(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

fn lane_summary(project: &Project, lane: &Lane) -> LaneSummary {
    LaneSummary {
        lane_id: lane.id,
        system_key: lane.system_key,
        name: lane.name.clone(),
        color: lane.color.as_str().to_owned(),
        counts_as_done: lane.counts_as_done,
        card_count: count(project.cards_in(lane.id).len()),
    }
}

fn done_lane_ids(project: &Project) -> Vec<Uuid> {
    project
        .lanes
        .iter()
        .filter(|l| l.counts_as_done)
        .map(|l| l.id)
        .collect()
}

fn upcoming_due(project: &Project, today: NaiveDate) -> Vec<UpcomingCard> {
    let done = done_lane_ids(project);
    let limit = today + Duration::days(UPCOMING_DAYS);
    let mut cards: Vec<(&Card, NaiveDate)> = project
        .cards
        .iter()
        .filter(|c| !done.contains(&c.lane_id))
        .filter_map(|c| c.due_date.map(|due| (c, due)))
        .filter(|(_, due)| *due <= limit)
        .collect();
    cards.sort_by_key(|(c, due)| (*due, c.id));
    cards
        .into_iter()
        .take(UPCOMING_LIMIT)
        .map(|(c, due)| UpcomingCard {
            card_id: c.id,
            lane_id: c.lane_id,
            title: c.title.clone(),
            due_date: due,
            overdue: due < today,
        })
        .collect()
}

/// Cartões das raias do meio: depois da primeira raia e fora das que contam como concluídas.
fn in_progress(project: &Project) -> Vec<InProgressCard> {
    let first = project.lanes.first().map(|l| l.id);
    let mut cards: Vec<(u8, i32, &Card)> = Vec::new();
    for lane in &project.lanes {
        if Some(lane.id) == first || lane.counts_as_done {
            continue;
        }
        for card in project.cards_in(lane.id) {
            cards.push((CardPriority::rank(card.priority), lane.position, card));
        }
    }
    cards.sort_by_key(|(rank, lane_position, c)| (*rank, *lane_position, c.position));
    cards
        .into_iter()
        .map(|(_, _, c)| {
            let (done, total) = c.checklist_progress();
            InProgressCard {
                card_id: c.id,
                lane_id: c.lane_id,
                title: c.title.clone(),
                priority: c.priority,
                due_date: c.due_date,
                checklist_done: done,
                checklist_total: total,
            }
        })
        .collect()
}

impl ProjectSummary {
    pub fn build(project: &Project, today: NaiveDate) -> Self {
        let (done_cards, total_cards) = project.progress();
        Self {
            progress: SummaryProgress {
                done_cards,
                total_cards,
            },
            lanes: project
                .lanes
                .iter()
                .map(|l| lane_summary(project, l))
                .collect(),
            upcoming_due: upcoming_due(project, today),
            in_progress: in_progress(project),
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, NaiveDate, Utc};
    use uuid::Uuid;

    use super::*;
    use crate::projects::domain::card::{CardPriority, build_checklist};
    use crate::projects::domain::project::{NewCard, Project};
    use crate::shared::visibility::Visibility;

    fn now() -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp(1_793_534_400, 0).unwrap()
    }

    fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 11, 1).unwrap()
    }

    fn day(offset: i64) -> NaiveDate {
        today() + chrono::Duration::days(offset)
    }

    fn project() -> Project {
        let mut n = 100u128;
        Project::new(
            Uuid::from_u128(1),
            Uuid::from_u128(2),
            Visibility::Personal,
            "Casa nova",
            None,
            now(),
            || {
                n += 1;
                Uuid::from_u128(n)
            },
        )
        .unwrap()
    }

    fn add(p: &mut Project, n: u128, lane: usize, due: Option<NaiveDate>) {
        let lane_id = p.lanes[lane].id;
        p.add_card(
            Uuid::from_u128(n),
            NewCard {
                lane_id,
                title: format!("c{n}"),
                due_date: due,
                ..NewCard::default()
            },
            now(),
        )
        .unwrap();
    }

    #[test]
    fn summary_lists_lane_progress_in_order() {
        let mut p = project();
        add(&mut p, 501, 0, None);
        add(&mut p, 502, 0, None);
        add(&mut p, 503, 2, None);

        let summary = ProjectSummary::build(&p, today());

        let lanes: Vec<_> = summary
            .lanes
            .iter()
            .map(|l| (l.card_count, l.counts_as_done))
            .collect();
        assert_eq!(lanes, [(2, false), (0, false), (1, true)]);
        assert_eq!(summary.lanes[0].lane_id, p.lanes[0].id);
        assert_eq!(summary.lanes[0].color, "#92400e");
    }

    #[test]
    fn summary_counts_done_cards_over_total() {
        let mut p = project();
        for n in 0..3 {
            add(&mut p, 510 + n, 1, None);
        }
        for n in 0..2 {
            add(&mut p, 520 + n, 2, None);
        }

        let summary = ProjectSummary::build(&p, today());

        assert_eq!(summary.progress.done_cards, 2);
        assert_eq!(summary.progress.total_cards, 5);
    }

    #[test]
    fn upcoming_due_includes_overdue_and_next_14_days_only() {
        let mut p = project();
        add(&mut p, 530, 0, Some(day(-3)));
        add(&mut p, 531, 1, Some(day(14)));
        add(&mut p, 532, 0, Some(day(15)));
        add(&mut p, 533, 0, None);
        add(&mut p, 534, 0, Some(day(0)));

        let summary = ProjectSummary::build(&p, today());

        let due: Vec<_> = summary
            .upcoming_due
            .iter()
            .map(|c| (c.card_id.as_u128(), c.overdue))
            .collect();
        assert_eq!(due, [(530, true), (534, false), (531, false)]);
    }

    #[test]
    fn upcoming_due_excludes_cards_in_done_lanes() {
        let mut p = project();
        add(&mut p, 540, 2, Some(day(-1)));
        add(&mut p, 541, 0, Some(day(1)));

        let summary = ProjectSummary::build(&p, today());

        assert_eq!(summary.upcoming_due.len(), 1);
        assert_eq!(summary.upcoming_due[0].card_id.as_u128(), 541);
    }

    #[test]
    fn in_progress_lists_middle_lanes_with_checklist_and_priority() {
        let mut p = project();
        let middle = p.lanes[1].id;
        for (n, priority) in [
            (550u128, None),
            (551, Some(CardPriority::Low)),
            (552, Some(CardPriority::High)),
            (553, Some(CardPriority::Medium)),
        ] {
            let checklist = build_checklist(&[("a", true), ("b", false)], Uuid::now_v7).unwrap();
            p.add_card(
                Uuid::from_u128(n),
                NewCard {
                    lane_id: middle,
                    title: format!("c{n}"),
                    priority,
                    checklist,
                    ..NewCard::default()
                },
                now(),
            )
            .unwrap();
        }
        add(&mut p, 554, 0, None);
        add(&mut p, 555, 2, None);

        let summary = ProjectSummary::build(&p, today());

        let ids: Vec<_> = summary
            .in_progress
            .iter()
            .map(|c| c.card_id.as_u128())
            .collect();
        assert_eq!(ids, [552, 553, 551, 550]);
        assert_eq!(summary.in_progress[0].priority, Some(CardPriority::High));
        assert_eq!(summary.in_progress[0].checklist_done, 1);
        assert_eq!(summary.in_progress[0].checklist_total, 2);
    }
}
