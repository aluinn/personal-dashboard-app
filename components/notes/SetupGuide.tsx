import Panel from "@/components/ui/Panel";

export default function SetupGuide({ tokenSet, hasSource }: { tokenSet: boolean; hasSource: boolean }) {
  return (
    <Panel label="CONNECT NOTION // 5 MINUTES" accent="violet">
      <p className="mb-3 text-sm text-muted">
        Until Notion is connected, the galaxy and cards show clearly-badged <span className="text-text">placeholder</span> notes. Once real pages sync for a
        module, that module’s placeholders disappear. The connection is read-only: the dashboard can read pages you share with it and nothing else.
      </p>
      <ol className="list-decimal space-y-2.5 pl-5 text-sm">
        <li className={tokenSet ? "text-teal" : ""}>
          <b>Create the integration.</b> Go to <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="text-teal underline decoration-dotted">notion.so/my-integrations</a> → <b>New integration</b>. Name it “Dashboard”, pick your workspace, type <b>Internal</b>. Under capabilities keep <b>Read content</b> ticked and untick update/insert. Save, then copy the <b>Internal Integration Secret</b> (starts <code>ntn_</code> or <code>secret_</code>). {tokenSet && "✓ A token is set."}
        </li>
        <li>
          <b>Put the secret in <code>.env.local</code></b> (never in a web form), then restart <code>npm run dev</code>:
          <pre className="mt-1 overflow-x-auto rounded-sm border border-line p-2 text-[11px] text-text/80">NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxxxxxx</pre>
        </li>
        <li>
          <b>Share your notes with the integration.</b> In Notion open your notes page or database → <b>•••</b> (top right) → <b>Connections</b> → add “Dashboard”. Sharing a parent page also shares everything inside it. The integration can’t see anything you haven’t shared.
        </li>
        <li className={hasSource ? "text-teal" : ""}>
          <b>Tell the dashboard where they are.</b> Pick whichever matches how you write:
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
            <li><b>One database</b> with a <code>Module</code> property (select or text: <code>HPSC0014</code>, or the module name). Paste its URL in <b>Settings → Notion</b>. Pages with no Module property still match if the title contains the code, e.g. “HPSC0037 Week 3”.</li>
            <li><b>One page per module:</b> paste each module’s page URL into <b>Settings → Modules → Notion notes URL</b>. Every sub-page becomes a note. A module URL can also point at a database.</li>
          </ul>
          {hasSource && " ✓ A source is configured."}
        </li>
        <li>
          <b>Press “Sync now”.</b> After that it refreshes on a schedule (default every 3 hours while the app is running) and only re-reads pages that changed.
        </li>
      </ol>
      <p className="micro mt-3 normal-case tracking-wide !text-[10px]">
        Optional database properties the dashboard understands: <code>Tags</code> (multi-select; drives the links in the galaxy), <code>Week</code> (number), <code>Term</code> (Term 1/2/3), <code>Year</code>.
        Typing <code>#AI</code> or <code>#regulation</code> inside a page also adds those as tags.
      </p>
    </Panel>
  );
}
