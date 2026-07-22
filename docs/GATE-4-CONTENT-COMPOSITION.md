# Gate 4 content composition

Gate 4 adds controlled visual composition without turning content files into executable page-builder configuration. All layouts, surfaces, responsive behavior, and renderers remain registered in the frontend repository.

## Detailed footer

Open **Site settings** to configure the global footer. It supports a brand summary, ordered link columns, social and legal links, newsletter copy and destination, supporting images, and light, dark, centered, or image-backed appearances. Image-backed footers require an accessible fallback and a registered overlay strength. Newsletter content links to an explicitly configured HTTPS or site-relative destination; content never stores provider secrets or scripts.

## Registered layouts

Add a **Content grid** block to use one-column, two-column, three-column, or card-grid presentation. Editors may select registered alignment, surface, and spacing options. Three-column and card layouts collapse to two columns and then one column while keeping the authored reading order. Arbitrary HTML, CSS, grids, and breakpoints are not accepted.

## Reusable blocks and refinements

1. Open **Reusable blocks** and add a registered Hero, Rich text, or Content grid source.
2. Give it a stable ID and name, author its shared content, and select the top-level fields that page instances may refine.
3. Save the reusable library before linking a page block to it.
4. On a page, select a block and choose the reusable source under **Use reusable block**.
5. Edit any allowed fields for that page. Only differences from the shared source are stored as instance refinements.
6. Choose **Detach copy** when the page should stop receiving shared changes.

Shared source changes appear on linked pages after refresh without a frontend deployment. References have one source and one refinement layer; nested reusable references are not supported. The server rejects missing sources, mismatched block types, unapproved override fields, and invalid merged content.

## Media foundation

Open **Media** to register reusable image metadata: stable ID, name, safe site-relative or HTTPS source, required alternative text, optional caption and intrinsic dimensions, and a percentage focal point. Gate 4 keeps binary media and configuration content-only; it does not add executable upload handlers to the content repository. Content grids and footer imagery use the same safe URL and alternative-text rules.

## Permanent deletion

Permanent deletion is intentionally separate from archiving:

1. Remove the page from Navigation and any reusable-content dependencies.
2. Archive the page and save that change.
3. Open the archived page and choose **Delete permanently…**.
4. Type its exact slug or title and confirm.

The server protects the home page, checks the current revision and dependencies, and removes the page plus its validation artifact in one content-repository commit. The CMS cannot undo this action; Git history is the emergency recovery path. Saving or deleting content never modifies the frontend repository or triggers a frontend deployment.
