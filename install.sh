#!/bin/sh
set -eu

REPO="nestoralonsovina/knals"
INSTALL_DIR="$HOME/.knals/bin"

OS="$(uname -s)"
if [ "$OS" != "Darwin" ]; then
  echo "Error: knals only supports macOS. Detected: $OS" >&2
  exit 1
fi

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
  echo "Error: knals only supports Apple Silicon (arm64). Detected: $ARCH" >&2
  exit 1
fi

if [ $# -ge 1 ]; then
  VERSION="$1"
else
  VERSION="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": *"//;s/".*//')"
  if [ -z "$VERSION" ]; then
    echo "Error: could not determine latest release version" >&2
    exit 1
  fi
fi

TAG="$VERSION"
VERSION_NUM="${VERSION#v}"

TARBALL="knals-v${VERSION_NUM}-darwin-arm64.tar.gz"
URL="https://github.com/${REPO}/releases/download/${TAG}/${TARBALL}"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Downloading knals ${VERSION_NUM}..."
curl -fsSL "$URL" -o "$TMPDIR/$TARBALL"

echo "Installing to ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMPDIR/$TARBALL" -C "$INSTALL_DIR" --strip-components=1

chmod +x "$INSTALL_DIR/knals" "$INSTALL_DIR/knals-server"

EXPORT_LINE="export PATH=\"\$HOME/.knals/bin:\$PATH\""

add_to_path() {
  RC_FILE="$1"
  if [ -f "$RC_FILE" ] && grep -qF '.knals/bin' "$RC_FILE"; then
    echo "PATH already configured in $RC_FILE"
    return
  fi
  printf "Add knals to PATH in %s? [Y/n] " "$RC_FILE"
  read -r REPLY </dev/tty 2>/dev/null || REPLY="y"
  case "$REPLY" in
    [nN]*) echo "Skipped. Add manually: $EXPORT_LINE" ;;
    *)
      echo "" >> "$RC_FILE"
      echo "# knals" >> "$RC_FILE"
      echo "$EXPORT_LINE" >> "$RC_FILE"
      echo "Added to $RC_FILE"
      ;;
  esac
}

case "${SHELL:-}" in
  */zsh)  add_to_path "$HOME/.zshrc" ;;
  */bash) add_to_path "$HOME/.bashrc" ;;
  *)
    if [ -f "$HOME/.zshrc" ]; then
      add_to_path "$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then
      add_to_path "$HOME/.bashrc"
    else
      echo "Could not detect shell. Add manually: $EXPORT_LINE"
    fi
    ;;
esac

echo ""
echo "knals ${VERSION_NUM} installed successfully!"
echo ""
echo "  Location: ${INSTALL_DIR}/knals"
echo ""
if ! echo "$PATH" | grep -qF '.knals/bin'; then
  echo "  Restart your shell or run:"
  echo "    export PATH=\"\$HOME/.knals/bin:\$PATH\""
  echo ""
fi
echo "  Then run: knals"
