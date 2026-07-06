import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useActionFeedback } from "../components/ActionFeedback";
import type { BackendAdminConsoleData, BackendPlatformSettings, BackendSessionState } from "../runtime/backendApi";
import { CheckboxField, Field, NumberInput } from "./shared";

type RestrictionLevel = "none" | "watched" | "restricted" | "generation_hold" | "banned";

interface AdminConsolePageProps {
  backendMode: boolean;
  backendSession?: BackendSessionState | null;
  data?: BackendAdminConsoleData;
  status?: string;
  onRefresh?: () => Promise<void> | void;
  onSetUserStatus: (userId: string, status: "pending_verification" | "active" | "disabled") => Promise<void>;
  onCreateRestriction: (
    userId: string,
    input: {
      level: RestrictionLevel;
      reason: string;
      sharingDisabled?: boolean;
      generationDisabled?: boolean;
      contextTokenCap?: number;
    },
  ) => Promise<void>;
  onUpdateSafetyEvent: (eventId: string, status: "open" | "reviewed" | "dismissed") => Promise<void>;
  onCreateInvite: (input: { note?: string; maxUses?: number; expiresInDays?: number }) => Promise<{ token: string }>;
  onDisableInvite: (inviteId: string) => Promise<void>;
  onSavePlatformSettings: (settings: Partial<BackendPlatformSettings>) => Promise<BackendPlatformSettings>;
}

function formatDate(iso?: string): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleString();
}

function shortId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

export function AdminConsolePage({
  backendMode,
  backendSession,
  data,
  status,
  onRefresh,
  onSetUserStatus,
  onCreateRestriction,
  onUpdateSafetyEvent,
  onCreateInvite,
  onDisableInvite,
  onSavePlatformSettings,
}: AdminConsolePageProps) {
  const { confirmAction, notify } = useActionFeedback();
  const [targetUserId, setTargetUserId] = useState("");
  const [restrictionLevel, setRestrictionLevel] = useState<RestrictionLevel>("watched");
  const [restrictionReason, setRestrictionReason] = useState("Manual admin review.");
  const [sharingDisabled, setSharingDisabled] = useState(true);
  const [generationDisabled, setGenerationDisabled] = useState(false);
  const [contextTokenCap, setContextTokenCap] = useState(0);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteMaxUses, setInviteMaxUses] = useState(1);
  const [inviteExpiresInDays, setInviteExpiresInDays] = useState(14);
  const [createdInviteToken, setCreatedInviteToken] = useState("");
  const [adminActionStatus, setAdminActionStatus] = useState("");
  const [safetyEventActionId, setSafetyEventActionId] = useState("");
  const [inviteActionId, setInviteActionId] = useState("");
  const [platformDraft, setPlatformDraft] = useState<BackendPlatformSettings | undefined>();

  useEffect(() => {
    if (!targetUserId && data?.users[0]) setTargetUserId(data.users[0].id);
  }, [data?.users, targetUserId]);

  useEffect(() => {
    if (data?.platformSettings) setPlatformDraft(data.platformSettings);
  }, [data?.platformSettings]);

  const targetUser = useMemo(
    () => data?.users.find((user) => user.id === targetUserId),
    [data?.users, targetUserId],
  );

  function updatePlatformProvider(patch: Partial<BackendPlatformSettings["provider"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, provider: { ...platformDraft.provider, ...patch } });
  }

  function updatePlatformBackground(patch: Partial<BackendPlatformSettings["background"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, background: { ...platformDraft.background, ...patch } });
  }

  function updatePlatformFeatures(patch: Partial<BackendPlatformSettings["features"]>) {
    if (!platformDraft) return;
    setPlatformDraft({ ...platformDraft, features: { ...platformDraft.features, ...patch } });
  }

  async function createInvite() {
    setAdminActionStatus("Creating invite...");
    notify("Creating invite...", { type: "info" });
    try {
      const result = await onCreateInvite({
        note: inviteNote,
        maxUses: inviteMaxUses,
        expiresInDays: inviteExpiresInDays,
      });
      setCreatedInviteToken(result.token);
      setAdminActionStatus("Invite created.");
      notify("Invite created.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite creation failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function savePlatformSettings() {
    if (!platformDraft) return;
    const confirmed = await confirmAction({
      title: "Save platform settings?",
      message: "These settings apply backend-wide to everyone using the platform defaults.",
      confirmLabel: "Save Settings",
    });
    if (!confirmed) return;
    setAdminActionStatus("Saving platform settings...");
    notify("Saving platform settings...", { type: "info" });
    try {
      const result = await onSavePlatformSettings(platformDraft);
      setPlatformDraft(result);
      setAdminActionStatus("Platform settings saved.");
      notify("Platform settings saved.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Platform settings save failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function updateSafetyEvent(eventId: string, nextStatus: "open" | "reviewed" | "dismissed") {
    setSafetyEventActionId(eventId);
    setAdminActionStatus(`Updating safety event ${shortId(eventId)}...`);
    notify(`Updating safety event ${shortId(eventId)}...`, { type: "info" });
    try {
      await onUpdateSafetyEvent(eventId, nextStatus);
      setAdminActionStatus(`Safety event ${shortId(eventId)} marked ${nextStatus}.`);
      notify(`Safety event marked ${nextStatus}.`, { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Safety event update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    } finally {
      setSafetyEventActionId("");
    }
  }

  async function updateUserStatus(userId: string, nextStatus: "pending_verification" | "active" | "disabled") {
    const userLabel = data?.users.find((user) => user.id === userId)?.email ?? shortId(userId);
    const confirmed = await confirmAction({
      title: "Change account status?",
      message: `Set ${userLabel} to ${nextStatus}? This changes their account access.`,
      confirmLabel: "Change Status",
      danger: nextStatus === "disabled",
    });
    if (!confirmed) return;
    setAdminActionStatus(`Updating ${userLabel}...`);
    notify("Updating account status...", { type: "info" });
    try {
      await onSetUserStatus(userId, nextStatus);
      setAdminActionStatus(`${userLabel} set to ${nextStatus}.`);
      notify("Account status updated.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "User status update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function applyRestriction() {
    if (!targetUser) return;
    const confirmed = await confirmAction({
      title: "Apply restriction?",
      message: `Apply ${restrictionLevel} restriction to ${targetUser.email}? This can limit sharing or generation for the account.`,
      confirmLabel: "Apply Restriction",
      danger: restrictionLevel === "banned" || restrictionLevel === "generation_hold" || generationDisabled || sharingDisabled,
    });
    if (!confirmed) return;
    setAdminActionStatus(`Applying restriction to ${targetUser.email}...`);
    notify("Applying account restriction...", { type: "info" });
    try {
      await onCreateRestriction(targetUser.id, {
        level: restrictionLevel,
        reason: restrictionReason,
        sharingDisabled,
        generationDisabled,
        contextTokenCap: contextTokenCap || undefined,
      });
      setAdminActionStatus(`Restriction applied to ${targetUser.email}.`);
      notify("Restriction applied.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restriction update failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    }
  }

  async function disableInvite(inviteId: string) {
    const confirmed = await confirmAction({
      title: "Deactivate invite?",
      message: "This invite link will no longer work for new account signup.",
      confirmLabel: "Deactivate",
      danger: true,
    });
    if (!confirmed) return;
    setInviteActionId(inviteId);
    setAdminActionStatus(`Disabling invite ${shortId(inviteId)}...`);
    notify("Deactivating invite...", { type: "info" });
    try {
      await onDisableInvite(inviteId);
      setAdminActionStatus(`Invite ${shortId(inviteId)} disabled.`);
      notify("Invite deactivated.", { type: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite disable failed.";
      setAdminActionStatus(message);
      notify(message, { type: "error" });
    } finally {
      setInviteActionId("");
    }
  }

  if (!backendMode) {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Admin Console</h2>
          </div>
        </header>
        <p className="notice">Admin Console is available in backend mode.</p>
      </section>
    );
  }

  if (!backendSession || backendSession.user.role !== "admin") {
    return (
      <section className="page library-page">
        <header className="library-header">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Admin Console</h2>
          </div>
        </header>
        <p className="notice">Admin access is required. Admin role is assigned only by backend configuration or backend data.</p>
      </section>
    );
  }

  const isLoading = !data && (!status || status.toLowerCase().includes("loading"));
  const hasLoadError = !data && Boolean(status) && !isLoading;

  return (
    <section className="page library-page admin-console-page">
      <header className="library-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Admin Console</h2>
          <p className="muted">Signed in as {backendSession.user.email}</p>
        </div>
      </header>

      {status && data && <p className="notice">{status}</p>}

      {data ? (
        <>
          <div className="admin-metric-grid">
            <Metric label="Users" value={data.totals.users} detail={`${data.totals.activeUsers} active`} />
            <Metric label="Adventures" value={data.totals.adventures} />
            <Metric label="Scenarios" value={data.totals.scenarioDrafts} detail={`${data.totals.publishedScenarioRevisions} published revisions`} />
            <Metric label="Safety" value={data.totals.openSafetyEvents} detail="open events" />
            <Metric label="Policy" value={data.totals.policyDecisions} detail="decisions" />
            <Metric label="Usage" value={data.totals.usageLogs} detail="model calls" />
          </div>

          {adminActionStatus && <p className="notice">{adminActionStatus}</p>}

          <article className="panel settings-card settings-section-full">
            <div className="panel-heading">
              <div>
                <h3>Invite Links</h3>
                <p className="muted">Create account invites here. Admin role is still assigned only by backend configuration or backend data.</p>
              </div>
              <button type="button" onClick={() => void createInvite()}>
                Create Invite
              </button>
            </div>
            <div className="grid three">
              <Field label="Invite note">
                <input value={inviteNote} onChange={(event) => setInviteNote(event.target.value)} />
              </Field>
              <Field label="Max uses">
                <NumberInput min={1} value={inviteMaxUses} onChange={setInviteMaxUses} />
              </Field>
              <Field label="Expires in days">
                <NumberInput min={1} value={inviteExpiresInDays} onChange={setInviteExpiresInDays} />
              </Field>
            </div>
            {createdInviteToken && (
              <Field label="Created invite token">
                <input readOnly value={createdInviteToken} />
              </Field>
            )}
          </article>

          <article className="panel settings-card settings-section-full">
            <div className="panel-heading">
              <div>
                <h3>Platform Settings</h3>
                <p className="muted">Backend-wide non-secret defaults. Provider API keys and OAuth secrets stay in environment files.</p>
              </div>
              <button type="button" onClick={() => void savePlatformSettings()} disabled={!platformDraft}>
                Save Platform Settings
              </button>
            </div>
            {platformDraft ? (
              <>
                <div className="grid three">
                  <Field label="Provider name">
                    <input value={platformDraft.provider.name} onChange={(event) => updatePlatformProvider({ name: event.target.value })} />
                  </Field>
                  <Field label="Provider base URL">
                    <input value={platformDraft.provider.baseUrl} onChange={(event) => updatePlatformProvider({ baseUrl: event.target.value })} />
                  </Field>
                  <Field label="Provider model">
                    <input value={platformDraft.provider.model} onChange={(event) => updatePlatformProvider({ model: event.target.value })} />
                  </Field>
                  <Field label="Temperature">
                    <NumberInput min={0} max={2} value={platformDraft.provider.temperature} onChange={(temperature) => updatePlatformProvider({ temperature })} />
                  </Field>
                  <Field label="Max output tokens">
                    <NumberInput min={1} value={platformDraft.provider.maxOutputTokens} onChange={(maxOutputTokens) => updatePlatformProvider({ maxOutputTokens })} />
                  </Field>
                  <Field label="Top P">
                    <NumberInput min={0} max={1} value={platformDraft.provider.topP ?? 1} onChange={(topP) => updatePlatformProvider({ topP })} />
                  </Field>
                  <Field label="Presence penalty">
                    <NumberInput min={0} max={2} value={platformDraft.provider.presencePenalty ?? 0} onChange={(presencePenalty) => updatePlatformProvider({ presencePenalty })} />
                  </Field>
                  <Field label="Frequency penalty">
                    <NumberInput min={0} max={2} value={platformDraft.provider.frequencyPenalty ?? 0} onChange={(frequencyPenalty) => updatePlatformProvider({ frequencyPenalty })} />
                  </Field>
                  <CheckboxField
                    label="Prompt caching"
                    checked={platformDraft.provider.promptCaching ?? false}
                    onChange={(promptCaching) => updatePlatformProvider({ promptCaching })}
                  />
                  <Field label="OpenRouter routing preference">
                    <select
                      value={platformDraft.provider.openRouterProviderSort ?? ""}
                      onChange={(event) =>
                        updatePlatformProvider({
                          openRouterProviderSort: (event.target.value || undefined) as BackendPlatformSettings["provider"]["openRouterProviderSort"],
                        })
                      }
                    >
                      <option value="">Balanced default</option>
                      <option value="price">Lowest price</option>
                      <option value="latency">Lowest latency</option>
                      <option value="throughput">Highest throughput</option>
                    </select>
                  </Field>
                </div>
                  <p className="muted">
                    OpenRouter routing is platform-wide when users use the platform model. Balanced default lets OpenRouter
                    weigh cost and uptime; price, latency, or throughput force a stronger preference. If OpenRouter reports
                    a data-policy endpoint error, use Balanced or loosen the workspace key policy.
                  </p>
                <div className="grid three" style={{ marginTop: "0.75rem" }}>
                  <CheckboxField
                    label="Enable semantic evaluation"
                    checked={platformDraft.background.semanticEvaluationEnabled}
                    onChange={(semanticEvaluationEnabled) => updatePlatformBackground({ semanticEvaluationEnabled })}
                  />
                  <Field label="Semantic eval every N turns">
                    <NumberInput min={0} value={platformDraft.background.semanticEvalEveryNTurns} onChange={(semanticEvalEveryNTurns) => updatePlatformBackground({ semanticEvalEveryNTurns })} />
                  </Field>
                  <CheckboxField
                    label="Enable memory detection"
                    checked={platformDraft.background.memoryDetectionEnabled}
                    onChange={(memoryDetectionEnabled) => updatePlatformBackground({ memoryDetectionEnabled })}
                  />
                  <Field label="Memory detection every N turns">
                    <NumberInput min={1} value={platformDraft.background.memoryDetectionEveryNTurns} onChange={(memoryDetectionEveryNTurns) => updatePlatformBackground({ memoryDetectionEveryNTurns })} />
                  </Field>
                  <CheckboxField
                    label="Scenario publishing"
                    checked={platformDraft.features.scenarioPublishingEnabled}
                    onChange={(scenarioPublishingEnabled) => updatePlatformFeatures({ scenarioPublishingEnabled })}
                  />
                  <CheckboxField
                    label="Developer tools visible to admins"
                    checked={platformDraft.features.developerToolsVisibleToAdmins}
                    onChange={(developerToolsVisibleToAdmins) => updatePlatformFeatures({ developerToolsVisibleToAdmins })}
                  />
                </div>
              </>
            ) : (
              <p className="muted">Platform settings load with the admin console.</p>
            )}
          </article>

          <article className="panel settings-card settings-section-full">
            <h3>Admin Actions</h3>
            <p className="muted">Admin role is read-only here. Promote admins through backend configuration or backend data only.</p>
            <div className="grid three">
              <Field label="Target user">
                <select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
                  {data.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} ({user.role})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Account status">
                <select
                  value={targetUser?.status ?? "active"}
                  onChange={(event) => targetUser && void updateUserStatus(targetUser.id, event.target.value as "pending_verification" | "active" | "disabled")}
                >
                  <option value="pending_verification">pending_verification</option>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </Field>
              <Field label="Restriction level">
                <select value={restrictionLevel} onChange={(event) => setRestrictionLevel(event.target.value as RestrictionLevel)}>
                  <option value="none">none</option>
                  <option value="watched">watched</option>
                  <option value="restricted">restricted</option>
                  <option value="generation_hold">generation_hold</option>
                  <option value="banned">banned</option>
                </select>
              </Field>
            </div>
            <Field label="Restriction reason">
              <input value={restrictionReason} onChange={(event) => setRestrictionReason(event.target.value)} />
            </Field>
            <div className="grid three">
              <CheckboxField label="Disable sharing" checked={sharingDisabled} onChange={setSharingDisabled} />
              <CheckboxField label="Disable generation" checked={generationDisabled} onChange={setGenerationDisabled} />
              <Field label="Context token cap (0 = unset)">
                <NumberInput min={0} value={contextTokenCap} onChange={setContextTokenCap} />
              </Field>
            </div>
            <div className="toolbar">
              <button
                type="button"
                disabled={!targetUser}
                onClick={() => void applyRestriction()}
              >
                Apply Restriction
              </button>
            </div>
          </article>

          <Section title="Users">
            <div className="context-table-wrap">
              <table className="context-table admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Restriction</th>
                    <th>Assets</th>
                    <th>Safety</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                        <div className="muted">{user.profileDisplayName} - {shortId(user.id)}</div>
                      </td>
                      <td>{user.role}</td>
                      <td>{user.status}</td>
                      <td>{user.currentRestriction.level}</td>
                      <td>{user.adventureCount} adv / {user.scenarioCount} scen</td>
                      <td>{user.openSafetyEventCount} open / {user.safetyEventCount} total</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Safety Events">
            <div className="context-table-wrap">
              <table className="context-table admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>User</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.safetyEvents.slice(0, 50).map((event) => (
                    <tr key={event.id}>
                      <td>{shortId(event.id)}<div className="muted">{formatDate(event.createdAt)}</div></td>
                      <td>{shortId(event.userId)}</td>
                      <td>{event.category} / severity {event.severity}</td>
                      <td>{event.status}</td>
                      <td>
                        <div className="toolbar">
                          <button
                            type="button"
                            disabled={safetyEventActionId === event.id || event.status === "reviewed"}
                            onClick={() => void updateSafetyEvent(event.id, "reviewed")}
                          >
                            {safetyEventActionId === event.id ? "Saving..." : "Review"}
                          </button>
                          <button
                            type="button"
                            disabled={safetyEventActionId === event.id || event.status === "dismissed"}
                            onClick={() => void updateSafetyEvent(event.id, "dismissed")}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            disabled={safetyEventActionId === event.id || event.status === "open"}
                            onClick={() => void updateSafetyEvent(event.id, "open")}
                          >
                            Reopen
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Restrictions">
            <CompactList
              items={data.restrictions.slice(0, 30).map((restriction) => ({
                id: restriction.id,
                title: `${restriction.level} - ${shortId(restriction.userId)}`,
                detail: `${restriction.reason || "No reason"} | sharing ${restriction.sharingDisabled ? "off" : "on"} | generation ${restriction.generationDisabled ? "off" : "on"}`,
                meta: formatDate(restriction.createdAt),
              }))}
            />
          </Section>

          <Section title="Invites">
            {data.invites.length ? (
              <div className="admin-compact-list">
                {data.invites.slice(0, 30).map((invite) => {
                  const disabled = Boolean(invite.disabledAt);
                  const usedUp = invite.useCount >= invite.maxUses;
                  return (
                    <div key={invite.id} className="admin-compact-row">
                      <div>
                        <strong>{invite.useCount}/{invite.maxUses} used - {invite.tokenHashPrefix}</strong>
                        <div className="muted">
                          {invite.note || "No note"} / expires {formatDate(invite.expiresAt)}
                          {disabled ? ` / disabled ${formatDate(invite.disabledAt)}` : ""}
                        </div>
                      </div>
                      <div className="toolbar">
                        {disabled ? (
                          <span className="status-pill">Disabled</span>
                        ) : usedUp ? (
                          <span className="status-pill">Used up</span>
                        ) : (
                          <button
                            type="button"
                            className="danger"
                            disabled={inviteActionId === invite.id}
                            onClick={() => void disableInvite(invite.id)}
                          >
                            {inviteActionId === invite.id ? "Disabling..." : "Deactivate"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No records.</p>
            )}
          </Section>

          <Section title="Adventures">
            <CompactList
              items={data.adventures.slice(0, 30).map((adventure) => ({
                id: adventure.id,
                title: adventure.title,
                detail: `${adventure.turnCount} turns, ${adventure.storyEntryCount} entries, owner ${shortId(adventure.ownerUserId)}`,
                meta: formatDate(adventure.updatedAt),
              }))}
            />
          </Section>

          <Section title="Scenarios">
            <CompactList
              items={data.scenarios.slice(0, 30).map((scenario) => ({
                id: scenario.id,
                title: scenario.title,
                detail: `${scenario.revisionCount} revisions, ${scenario.publishedRevisionCount} published, owner ${shortId(scenario.ownerUserId)}`,
                meta: formatDate(scenario.updatedAt),
              }))}
            />
          </Section>

          <Section title="Policy Decisions">
            <CompactList
              items={data.policyDecisions.slice(0, 40).map((decision) => ({
                id: decision.id,
                title: `${decision.action} / ${decision.gate} / severity ${decision.severity}`,
                detail: decision.categories.join(", ") || decision.rationale || "No rationale",
                meta: formatDate(decision.createdAt),
              }))}
            />
          </Section>

          <Section title="Usage And Context Builds">
            <div className="library-grid">
              <article className="library-card">
                <div className="library-card-body">
                  <h3>Usage Logs</h3>
                  <CompactList
                    items={data.usageLogs.slice(0, 12).map((usage) => ({
                      id: usage.id,
                      title: `${usage.providerName} / ${usage.model}`,
                      detail: `user ${shortId(usage.userId)} / adventure ${shortId(usage.adventureId)}`,
                      meta: formatDate(usage.createdAt),
                    }))}
                  />
                </div>
              </article>
              <article className="library-card">
                <div className="library-card-body">
                  <h3>Context Builds</h3>
                  <CompactList
                    items={data.contextBuilds.slice(0, 12).map((build) => ({
                      id: build.id,
                      title: `${build.gate} / ${build.totalEstimatedTokens} tokens`,
                      detail: `${build.messageCount} messages, ${build.sectionCount} sections, ${build.excludedItemCount} excluded`,
                      meta: formatDate(build.createdAt),
                    }))}
                  />
                </div>
              </article>
            </div>
          </Section>

          <Section title="Admin Audit Log">
            <CompactList
              items={data.adminActions.slice(0, 40).map((action) => ({
                id: action.id,
                title: `${action.action} / ${action.targetType}`,
                detail: `${action.reason || "No reason"} / target ${shortId(action.targetId)}`,
                meta: formatDate(action.createdAt),
              }))}
            />
          </Section>
        </>
      ) : isLoading ? (
        <AdminConsoleLoading status={status || "Loading admin console..."} />
      ) : hasLoadError ? (
        <AdminConsoleLoadError message={status || "Admin console load failed."} onRefresh={onRefresh} />
      ) : (
        <AdminConsoleLoading status="Waiting for admin data..." />
      )}
    </section>
  );
}

function AdminConsoleLoadError({ message, onRefresh }: { message: string; onRefresh?: () => Promise<void> | void }) {
  return (
    <article className="panel admin-load-error" role="alert">
      <div>
        <p className="eyebrow">Load failed</p>
        <h3>Admin data could not load.</h3>
        <p className="muted">{message}</p>
      </div>
      {onRefresh && (
        <button type="button" onClick={() => void onRefresh()}>
          Retry
        </button>
      )}
    </article>
  );
}

function AdminConsoleLoading({ status }: { status: string }) {
  return (
    <div className="admin-loading" role="status" aria-live="polite">
      <div className="admin-loading-banner">
        <span className="admin-loading-spinner" aria-hidden="true" />
        <div>
          <p className="admin-loading-title">{status}</p>
          <p className="muted">Fetching users, adventures, scenarios, safety events, usage, and platform settings.</p>
        </div>
      </div>
      <div className="admin-metric-grid admin-loading-grid" aria-hidden="true">
        {["Users", "Adventures", "Scenarios", "Safety", "Policy", "Usage"].map((label) => (
          <article className="panel admin-metric-card admin-metric-card-loading" key={label}>
            <p className="eyebrow">{label}</p>
            <span className="skeleton-line skeleton-number" />
            <span className="skeleton-line skeleton-caption" />
          </article>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <article className="panel admin-metric-card">
      <p className="eyebrow">{label}</p>
      <strong>{value.toLocaleString()}</strong>
      {detail && <span className="muted">{detail}</span>}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="panel settings-card settings-section-full admin-section">
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function CompactList({ items }: { items: Array<{ id: string; title: string; detail: string; meta: string }> }) {
  if (items.length === 0) return <p className="muted">No records.</p>;
  return (
    <div className="admin-compact-list">
      {items.map((item) => (
        <div key={item.id} className="admin-compact-row">
          <div>
            <strong>{item.title}</strong>
            <p className="muted">{item.detail}</p>
          </div>
          <span className="status-pill">{item.meta}</span>
        </div>
      ))}
    </div>
  );
}
