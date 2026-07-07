# iTerm2 profile

`profile.json` is an importable iTerm2 profile that mirrors the shared dark terminal palette used by Ghostty/Kitty.

## Import

In iTerm2:

```text
Settings → Profiles → Other Actions → Import JSON Profiles
```

Select:

```text
~/dotfiles/iterm2/profile.json
```

Then select the imported profile named `Dotfiles Dark`.

## Font

Install the font first:

```bash
brew install --cask font-jetbrains-mono-nerd-font
```

The profile uses:

```text
JetBrainsMonoNFM-Regular 14
```

## Frosted/transparent window

The profile enables transparency and blur. You can adjust these in:

```text
Settings → Profiles → Window → Transparency / Blur
```

## Hotkey window

The global iTerm2 hotkey is not reliably stored in an importable profile JSON. Configure it manually:

```text
iTerm2 Settings → Keys → Hotkey → Create a Dedicated Hotkey Window
```

Suggested hotkey:

```text
Ctrl + Shift + \
```

Use the `Dotfiles Dark` profile for the hotkey window.
