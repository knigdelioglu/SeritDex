package tr.seritdex.wm

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val Navy = Color(0xFF101827)
private val Panel = Color(0xFF192538)
private val Accent = Color(0xFF73B5FF)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SeritDexScreen() }
    }
}

@Composable
private fun SeritDexScreen() {
    val context = LocalContext.current
    val windows by AppState.windows.collectAsState()
    val connected by AppState.connected.collectAsState()
    val visible by AppState.hudVisible.collectAsState()
    val apps = remember { AppLauncher.installedApps(context) }
    var search by rememberSaveable { mutableStateOf("") }
    var ratio by rememberSaveable { mutableFloatStateOf(0.5f) }
    val ratios = listOf(0.3333f to "1/3", 0.5f to "1/2", 0.6667f to "2/3", 1f to "Tam")

    fun launch(pkg: String) {
        val error = AppLauncher.open(context, pkg, ratio)
        if (error != null) Toast.makeText(context, error, Toast.LENGTH_LONG).show()
    }

    MaterialTheme(colorScheme = darkColorScheme(primary = Accent, background = Navy, surface = Panel)) {
        Column(
            modifier = Modifier.fillMaxSize().background(Navy).safeDrawingPadding().padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text("ŞeritDeX", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
            Text("Android 16 • Samsung DeX • Yerel pencere paneli", color = Color.LightGray)
            Surface(color = if (connected) Color(0xFF17483D) else Color(0xFF483323), shape = RoundedCornerShape(14.dp)) {
                Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (connected) "Pencere erişimi etkin" else "Pencere erişimi kapalı", fontWeight = FontWeight.SemiBold)
                    Text(
                        if (connected) "Pencereler izleniyor. Alt + Sol/Sağ: hızlı geçiş, Alt + Boşluk: HUD."
                        else "Açık DeX pencerelerini görmek ve alt hızlı erişim şeridini kullanmak için erişilebilirlik hizmetini açın.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = { context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)) }) {
                            Text("Erişilebilirlik")
                        }
                        OutlinedButton(enabled = connected, onClick = {
                            AppState.hudVisible.value = !visible
                            DexAccessibilityService.active?.updateHud()
                        }) { Text(if (visible) "HUD'u gizle" else "HUD'u göster") }
                    }
                }
            }
            Text("Yeni pencere genişliği", style = MaterialTheme.typography.titleSmall)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ratios.forEach { (value, label) ->
                    FilterChip(selected = ratio == value, onClick = { ratio = value }, label = { Text(label) })
                }
            }
            Text(
                "Genişlik bir DeX açılış isteğidir; mevcut üçüncü taraf görevleri zorla boyutlandırmaz.",
                color = Color.LightGray, style = MaterialTheme.typography.bodySmall
            )
            StripControlPanel()
            OutlinedTextField(
                value = search, onValueChange = { search = it },
                label = { Text("Uygulama ara") }, modifier = Modifier.fillMaxWidth(), singleLine = true
            )
            BoxWithConstraints(Modifier.fillMaxWidth().weight(1f)) {
                val openItems = windows.filter { it.title.contains(search, true) || it.packageName.contains(search, true) }
                val appItems = apps.filter { it.label.contains(search, true) || it.packageName.contains(search, true) }
                if (maxWidth >= 720.dp) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        WindowList("Açık pencereler (" + openItems.size + ")", openItems,
                            Modifier.weight(1f).fillMaxHeight(), ::launch)
                        InstalledList("Uygulamalar (" + appItems.size + ")", appItems,
                            Modifier.weight(1f).fillMaxHeight(), ::launch)
                    }
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        WindowList("Açık pencereler (" + openItems.size + ")", openItems,
                            Modifier.weight(1f).fillMaxWidth(), ::launch)
                        InstalledList("Uygulamalar (" + appItems.size + ")", appItems,
                            Modifier.weight(1f).fillMaxWidth(), ::launch)
                    }
                }
            }
        }
    }
}

@Composable
private fun WindowList(title: String, windows: List<LiveWindow>, modifier: Modifier, onLaunch: (String) -> Unit) {
    Surface(modifier, shape = RoundedCornerShape(14.dp), color = Panel) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(windows, key = { it.id }) { window ->
                    OutlinedButton(onClick = { onLaunch(window.packageName) }, modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.fillMaxWidth()) {
                            Text(window.title, maxLines = 1)
                            Text(
                                window.bounds.width().toString() + " × " + window.bounds.height() + " px" +
                                    if (window.focused) " • Odakta" else "",
                                style = MaterialTheme.typography.labelSmall, color = Color.LightGray
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InstalledList(title: String, apps: List<LaunchableApp>, modifier: Modifier, onLaunch: (String) -> Unit) {
    Surface(modifier, shape = RoundedCornerShape(14.dp), color = Panel) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.Bold)
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(apps, key = { it.packageName }) { app ->
                    TextButton(onClick = { onLaunch(app.packageName) }, modifier = Modifier.fillMaxWidth()) {
                        Text(app.label, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        }
    }
}

@Composable
private fun StripControlPanel() {
    val context = LocalContext.current
    val status by ShizukuStripController.status.collectAsState()
    val connected by ShizukuStripController.connected.collectAsState()
    val tasks by ShizukuStripController.tasks.collectAsState()
    val selected by ShizukuStripController.focusedIndex.collectAsState()
    val fraction by ShizukuStripController.widthFraction.collectAsState()
    Surface(shape = RoundedCornerShape(14.dp), color = Panel) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Yatay pencere şeridi • Deneysel", fontWeight = FontWeight.Bold)
            Text(
                "Gerçek pencereleri taşımak için Shizuku (ADB yetkisi) gerekir. One UI 8 pencere sınırlarını değiştirebilir.",
                style = MaterialTheme.typography.bodySmall, color = Color.LightGray
            )
            Text(status, style = MaterialTheme.typography.bodySmall,
                color = if (connected) Color(0xFFA4F4C2) else Color(0xFFFFD48A))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Button(onClick = { ShizukuStripController.connect(context) }) {
                    Text(if (connected) "Bağlı" else "Shizuku bağla")
                }
                OutlinedButton(enabled = connected, onClick = { ShizukuStripController.refresh() }) {
                    Text("Pencereleri bul")
                }
                OutlinedButton(enabled = connected && tasks.isNotEmpty(), onClick = {
                    ShizukuStripController.restore()
                }) { Text("Kurtar") }
            }
            if (connected && tasks.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf(0.3333f to "1/3", 0.5f to "1/2", 0.6667f to "2/3", 1f to "Tam").forEach { (v, label) ->
                        FilterChip(selected = fraction == v, onClick = {
                            ShizukuStripController.widthFraction.value = v
                        }, label = { Text(label) })
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(enabled = selected > 0, onClick = { ShizukuStripController.step(-1) }) { Text("←") }
                    OutlinedButton(onClick = { ShizukuStripController.apply() }) { Text("Şeridi uygula") }
                    Button(enabled = selected < tasks.lastIndex, onClick = {
                        ShizukuStripController.step(1)
                    }) { Text("→") }
                }
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    tasks.forEachIndexed { index, task ->
                        FilterChip(
                            selected = index == selected,
                            onClick = {
                                ShizukuStripController.focusedIndex.value = index
                                ShizukuStripController.apply()
                            },
                            label = { Text(task.packageName.substringAfterLast('.').take(18)) }
                        )
                    }
                }
            }
        }
    }
}
