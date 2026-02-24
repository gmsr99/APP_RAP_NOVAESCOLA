import { differenceInMinutes, startOfDay, getHours, getMinutes } from 'date-fns';

export interface CalendarEvent {
    id: string | number;
    start: Date;
    end: Date;
    [key: string]: any;
}

export interface LayoutEvent extends CalendarEvent {
    top: string; // Percentage
    height: string; // Percentage
    left: string; // Percentage
    width: string; // Percentage
    zIndex: number;
}

/**
 * Computes the layout positions (top, height, left, width) for a list of events.
 * Events should all belong to the same day container.
 */
export function computeEventLayout<T extends CalendarEvent>(events: T[]): (T & LayoutEvent)[] {
    if (events.length === 0) return [];

    // 1. Sort events by start time, then by duration (longer first) or end time
    const sortedEvents = [...events].sort((a, b) => {
        if (a.start.getTime() === b.start.getTime()) {
            return b.end.getTime() - a.end.getTime(); // Longer events first
        }
        return a.start.getTime() - b.start.getTime();
    });

    // 2. Group overlapping events into clusters
    const clusters: T[][] = [];
    let currentCluster: T[] = [];
    let clusterEnd = -1; // Timestamp

    for (const event of sortedEvents) {
        if (currentCluster.length === 0) {
            currentCluster.push(event);
            clusterEnd = event.end.getTime();
        } else {
            // Check overlap with the *entire cluster's range* 
            // Actually strictly: does it overlap with ANY event in the cluster?
            // Since sorted by start, we just need to check if event.start < clusterEnd
            if (event.start.getTime() < clusterEnd) {
                currentCluster.push(event);
                clusterEnd = Math.max(clusterEnd, event.end.getTime());
            } else {
                clusters.push(currentCluster);
                currentCluster = [event];
                clusterEnd = event.end.getTime();
            }
        }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    // 3. Process each cluster to assign columns
    const layoutEvents: (T & LayoutEvent)[] = [];

    for (const cluster of clusters) {
        // Determine columns
        const columns: T[][] = [];

        for (const event of cluster) {
            let placed = false;
            // Try to place in existing columns
            for (let i = 0; i < columns.length; i++) {
                const lastEventInColumn = columns[i][columns[i].length - 1];
                // If event starts after the last event in this column ends, we can place it here
                if (event.start.getTime() >= lastEventInColumn.end.getTime()) {
                    columns[i].push(event);
                    placed = true;
                    // Store the column index temporarily on the event object or a map if needed
                    // But we need to output the final layout. 
                    // Let's create a map relative to the event instance
                    (event as any).__colIndex = i;
                    break;
                }
            }

            if (!placed) {
                // Create new column
                columns.push([event]);
                (event as any).__colIndex = columns.length - 1;
            }
        }

        // 4. Calculate dimensions
        const maxColumns = columns.length;
        const colWidth = 100 / maxColumns;

        for (const event of cluster) {
            const colIndex = (event as any).__colIndex;

            // Calculate top and height based on 07:00 - 21:00 (840 minutes)
            const START_HOUR = 7;
            const END_HOUR = 21;
            const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 840
            const startOfDayTime = startOfDay(event.start);
            const startMinutes = differenceInMinutes(event.start, startOfDayTime) - START_HOUR * 60;
            const durationMinutes = differenceInMinutes(event.end, event.start);

            // Clamp to visible range
            const clampedStart = Math.max(0, startMinutes);
            const clampedEnd = Math.min(TOTAL_MINUTES, startMinutes + durationMinutes);
            const clampedDuration = Math.max(0, clampedEnd - clampedStart);

            const top = (clampedStart / TOTAL_MINUTES) * 100;
            const height = (clampedDuration / TOTAL_MINUTES) * 100;

            layoutEvents.push({
                ...event,
                top: `${top}%`,
                height: `${height}%`,
                left: `${colIndex * colWidth}%`,
                width: `${colWidth}%`,
                zIndex: 10 + colIndex, // Simple z-index
            });

            // Cleanup internal prop
            delete (event as any).__colIndex;
        }
    }

    return layoutEvents;
}
