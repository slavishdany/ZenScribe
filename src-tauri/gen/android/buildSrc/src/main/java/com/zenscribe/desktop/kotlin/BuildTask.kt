import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction
import javax.inject.Inject
import org.gradle.process.ExecOperations

abstract class BuildTask : DefaultTask() {
    @get:Inject
    abstract val execOperations: ExecOperations

    @Input
    var rootDirRel: String? = null
    @Input
    var projectDir: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val executable = """npm""";
        if (Os.isFamily(Os.FAMILY_WINDOWS)) {
            try {
                runTauriCli("cmd", listOf("/c", executable))
            } catch (e: Exception) {
                try {
                    runTauriCli("cmd", listOf("/c", "$executable.cmd"))
                } catch (fallbackException: Exception) {
                    throw fallbackException
                }
            }
        } else {
            runTauriCli(executable, emptyList())
        }
    }

    fun runTauriCli(executable: String, prefixArgs: List<String> = emptyList()) {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = prefixArgs + listOf("run", "--", "tauri", "android", "android-studio-script");

        val existingAarch64 = System.getenv("CARGO_TARGET_AARCH64_LINUX_ANDROID_RUSTFLAGS") ?: "-Clink-arg=-landroid -Clink-arg=-llog -Clink-arg=-lOpenSLES"
        val aarch64Flags = if (existingAarch64.contains("+fp16")) existingAarch64 else "-C target-feature=+fp16 $existingAarch64"

        execOperations.exec {
            workingDir(File(projectDir, rootDirRel))
            executable(executable)
            args(args)
            environment("CARGO_TARGET_AARCH64_LINUX_ANDROID_RUSTFLAGS", aarch64Flags)
            if (logger.isEnabled(LogLevel.DEBUG)) {
                args("-vv")
            } else if (logger.isEnabled(LogLevel.INFO)) {
                args("-v")
            }
            if (release) {
                args("--release")
            }
            args(listOf("--target", target))
        }.assertNormalExitValue()
    }
}
