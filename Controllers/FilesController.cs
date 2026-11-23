using Microsoft.AspNetCore.Mvc;

namespace TestProject.Controllers {
    [ApiController]
    [Route("api/files")]
    public class FilesController : ControllerBase {

        private readonly string _root;

        public FilesController(IConfiguration config, IWebHostEnvironment env) {
            _root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(config["HomeDirectory"] ?? "files", env.ContentRootPath));
            Directory.CreateDirectory(_root);
        }

        // Maps a client path onto the home directory; null if it escapes it
        private string? Resolve(string? relative) {
            var full = Path.GetFullPath(Path.Combine(_root, relative ?? ""));
            var inside = full == _root || full.StartsWith(_root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
            return inside ? full : null;
        }

        private string Relative(string full) {
            var relative = Path.GetRelativePath(_root, full);
            return relative == "." ? "" : relative.Replace(Path.DirectorySeparatorChar, '/');
        }

        [HttpGet]
        public IActionResult List(string? path, string? q) {
            var dir = Resolve(path);
            if (dir == null || !Directory.Exists(dir)) return NotFound();

            var options = new EnumerationOptions {
                IgnoreInaccessible = true,
                RecurseSubdirectories = !string.IsNullOrWhiteSpace(q)
            };

            var entries = new DirectoryInfo(dir).EnumerateFileSystemInfos("*", options)
                .Where(e => string.IsNullOrWhiteSpace(q) || e.Name.Contains(q, StringComparison.OrdinalIgnoreCase))
                .Select(e => new {
                    name = e.Name,
                    path = Relative(e.FullName),
                    isFolder = e is DirectoryInfo,
                    size = e is FileInfo f ? f.Length : 0,
                    modified = e.LastWriteTimeUtc
                })
                .OrderByDescending(e => e.isFolder).ThenBy(e => e.name, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(new {
                path = Relative(dir),
                entries,
                folderCount = entries.Count(e => e.isFolder),
                fileCount = entries.Count(e => !e.isFolder),
                totalSize = entries.Sum(e => e.size)
            });
        }

        [HttpGet("download")]
        public IActionResult Download(string path) {
            var file = Resolve(path);
            if (file == null || !System.IO.File.Exists(file)) return NotFound();
            return PhysicalFile(file, "application/octet-stream", Path.GetFileName(file), true);
        }

        [HttpPost("upload")]
        public async Task<IActionResult> Upload(string? path, List<IFormFile> files) {
            var dir = Resolve(path);
            if (dir == null || !Directory.Exists(dir)) return NotFound();

            foreach (var file in files) {
                var target = Path.Combine(dir, Path.GetFileName(file.FileName));
                using var stream = System.IO.File.Create(target);
                await file.CopyToAsync(stream);
            }
            return Ok();
        }
    }
}
