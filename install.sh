#!/bin/sh
set -eu

REPO="nestoralonsovina/knals"
INSTALL_DIR="$HOME/.knals/bin"

# --- Colors (tput with graceful fallback) ---
BOLD="$(tput bold 2>/dev/null || printf '')"
DIM="$(tput setaf 8 2>/dev/null || printf '')"
RED="$(tput setaf 1 2>/dev/null || printf '')"
GREEN="$(tput setaf 2 2>/dev/null || printf '')"
YELLOW="$(tput setaf 3 2>/dev/null || printf '')"
BLUE="$(tput setaf 4 2>/dev/null || printf '')"
MAGENTA="$(tput setaf 5 2>/dev/null || printf '')"
RST="$(tput sgr0 2>/dev/null || printf '')"

info()      { printf '%s\n' "${DIM}>${RST} $*"; }
error()     { printf '%s\n' "${RED}x${RST} $*" >&2; }
completed() { printf '%s\n' "${GREEN}✓${RST} $*"; }
ohai()      { printf '%s\n' "${BLUE}==>${BOLD} $*${RST}"; }

# --- Platform check ---
OS="$(uname -s)"
if [ "$OS" != "Darwin" ]; then
  error "knals only supports macOS. Detected: ${BOLD}${OS}${RST}"
  exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
  error "knals only supports Apple Silicon (arm64). Detected: ${BOLD}${ARCH}${RST}"
  exit 1
fi

# --- Resolve version ---
if [ $# -ge 1 ]; then
  VERSION="$1"
else
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": *"//;s/".*//')"
  if [ -z "$VERSION" ]; then
    error "Could not determine latest release version"
    exit 1
  fi
fi

TAG="$VERSION"
VERSION_NUM="${VERSION#v}"

printf '\n'
ohai "Installing knals v${VERSION_NUM}"
printf '\n'

# --- Download ---
TARBALL="knals-v${VERSION_NUM}-darwin-arm64.tar.gz"
URL="https://github.com/${REPO}/releases/download/${TAG}/${TARBALL}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

info "[1/3] Downloading from GitHub Releases..."
if curl --fail --location --progress-bar --output "$TMPDIR/$TARBALL" "$URL"; then
  completed "Downloaded ${DIM}${TARBALL}${RST}"
else
  error "Download failed. Check that version ${BOLD}${VERSION_NUM}${RST} exists."
  exit 1
fi

# --- Extract ---
info "[2/3] Extracting to ${BOLD}${INSTALL_DIR}${RST}"
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMPDIR/$TARBALL" -C "$INSTALL_DIR" --strip-components=1
chmod +x "$INSTALL_DIR/knals" "$INSTALL_DIR/knals-server"
completed "Installed binaries"

# --- PATH setup ---
EXPORT_LINE="export PATH=\"\$HOME/.knals/bin:\$PATH\""

add_to_path() {
  RC_FILE="$1"
  RC_NAME="$(basename "$RC_FILE")"
  if [ -f "$RC_FILE" ] && grep -qF '.knals/bin' "$RC_FILE"; then
    completed "PATH already configured in ${BOLD}${RC_NAME}${RST}"
    return
  fi
  printf '%s ' "${MAGENTA}?${RST} Add knals to PATH in ${BOLD}${RC_NAME}${RST}? [Y/n]"
  read -r REPLY </dev/tty 2>/dev/null || REPLY="y"
  case "$REPLY" in
    [nN]*)
      info "Skipped. Add manually:"
      printf '    %s\n' "$EXPORT_LINE"
      ;;
    *)
      printf '\n# knals\n%s\n' "$EXPORT_LINE" >> "$RC_FILE"
      completed "Added to ${BOLD}${RC_NAME}${RST}"
      ;;
  esac
}

info "[3/3] Configuring PATH"
case "${SHELL:-}" in
  */zsh)  add_to_path "$HOME/.zshrc" ;;
  */bash) add_to_path "$HOME/.bashrc" ;;
  *)
    if [ -f "$HOME/.zshrc" ]; then
      add_to_path "$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
      add_to_path "$HOME/.bashrc"
    else
      info "Could not detect shell. Add manually:"
      printf '    %s\n' "$EXPORT_LINE"
    fi
    ;;
esac

# --- Summary ---
printf '\n'
ohai "knals v${VERSION_NUM} installed successfully!"
printf '\n'
info "${BOLD}${INSTALL_DIR}/knals${RST}"
printf '\n'
if ! echo "$PATH" | grep -qF '.knals/bin'; then
  info "Restart your shell or run:"
  printf '    %s\n' "${DIM}export PATH=\"\$HOME/.knals/bin:\$PATH\"${RST}"
  printf '\n'
fi
info "Then run: ${BOLD}knals${RST}"
printf '\n'
