#ifndef SOCKET_UTILS_H
#define SOCKET_UTILS_H

#include <stddef.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>

/*
  INFO: Bind/connect in the abstract namespace: sun_path[0] stays NUL and the name
        follows it, so the socket has no filesystem path at all.

        A path-bound unix socket publishes its path in /proc/net/unix, which any
        app can read without privilege. Measured on OP15: an ordinary app uid and
        a uid on the hide list both saw "/data/adb/rezygisk/cp64.sock" and
        "/data/adb/rezygisk/init_monitor" there, which discloses the install
        location on its own. Abstract sockets are still listed, but as a bare name
        with no path, so nothing about where we live leaks.

        The name is the basename of the path the caller already passes, so both
        binaries derive the same name from constants they already agree on and
        there is nothing new to keep in sync.
*/
static inline socklen_t rzd_abstract_addr(struct sockaddr_un *addr, const char *path) {
  memset(addr, 0, sizeof(*addr));
  addr->sun_family = AF_UNIX;

  const char *name = strrchr(path, '/');
  name = name ? name + 1 : path;

  size_t name_len = strlen(name);
  if (name_len > sizeof(addr->sun_path) - 2) name_len = sizeof(addr->sun_path) - 2;
  memcpy(addr->sun_path + 1, name, name_len);

  return (socklen_t)(offsetof(struct sockaddr_un, sun_path) + 1 + name_len);
}


#define MAX_STRING_LEN 65536

#include <stdint.h>

#include <sys/types.h>

ssize_t write_loop(int fd, const void *buf, size_t count);

ssize_t read_loop_offset(int fd, void *buf, size_t len, off_t offset);

ssize_t read_loop(int fd, void *buf, size_t len);

ssize_t write_fd(int fd, int sendfd);

int read_fd(int fd);

ssize_t write_string(int fd, const char *str);

char *read_string(int fd);

#define write_func_def(type)              \
  ssize_t write_## type(int fd, type val)

#define read_func_def(type)               \
  ssize_t read_## type(int fd, type *val)

write_func_def(uint8_t);
read_func_def(uint8_t);

write_func_def(uint32_t);
read_func_def(uint32_t);

write_func_def(size_t);
read_func_def(size_t);

#endif /* SOCKET_UTILS_H */
