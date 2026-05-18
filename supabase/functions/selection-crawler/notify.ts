export async function notifyNewSelectionEvent(
  supabase: any,
  eventId: string,
  title: string,
) {
  const notificationTitle = "新しいセレクション情報";
  const notificationBody = `${title} が追加されました`;
  const targetUrl = `/selection/${eventId}`;

  const { data: teams, error } = await supabase
    .from("teams")
    .select("owner_id")
    .not("owner_id", "is", null)
    .limit(500);

  if (error) {
    await supabase.from("selection_notification_logs").insert({
      selection_event_id: eventId,
      notification_type: "push",
      title: notificationTitle,
      body: notificationBody,
      target_url: targetUrl,
      success: false,
      error_message: error.message,
    });
    return;
  }

  const userIds = Array.from(
    new Set((teams ?? []).map((t: any) => t.owner_id).filter(Boolean)),
  );

  for (const userId of userIds) {
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "selection_event",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        is_read: false,
      });

      await supabase.from("selection_notification_logs").insert({
        selection_event_id: eventId,
        user_id: userId,
        notification_type: "push",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        success: true,
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);

      await supabase.from("selection_notification_logs").insert({
        selection_event_id: eventId,
        user_id: userId,
        notification_type: "push",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        success: false,
        error_message: message,
      });
    }
  }
}