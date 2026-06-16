#!/bin/sh
# Wrapper so web-ext can launch snap Firefox with the correct snap runtime.
# web-ext invokes this as the firefox binary and passes all args through.
exec snap run firefox "$@"
